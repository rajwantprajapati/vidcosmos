// What the generate and retry jobs read and write besides the job (API §7, SDD §8): the draft
// they record, each scene's status, the narration cache in `assets` and the audio in storage,
// the usage events, moderation decisions and the saved version. Plain JSON in and out, so
// steps can memoise it; the function tests use an in-memory version.
import {
  findAsset,
  getJob,
  markJobScene,
  ObjectId,
  readGenerateSnapshot,
  recordAsset,
  recordModeration,
  recordUsage,
  saveGeneratedVersion,
  setJobScenes,
  sha256Hex,
  touchSpecAudio,
  type Db,
} from "@vidcosmos/db";
import { type ArtifactStore, narrationKey, type TtsProvider } from "@vidcosmos/integrations";
import {
  type ModerationResult,
  narrationCost,
  type NarrationTask,
  type Recording,
} from "@vidcosmos/pipeline";
import type { Job } from "@vidcosmos/spec/collections";
import type { EventData } from "@vidcosmos/spec/events";
import type { VideoSpec } from "@vidcosmos/spec/video";
import { z } from "zod";

export type NarrationJob = EventData<"video/generate.requested">;

export type JobSceneStatus = NonNullable<Job["scenes"]>[number]["status"];
export type SceneError = { code: string; message: string };

/** The draft a run records, and what the job asked for. */
export type NarrationInputs = {
  /** A whole generation, or a retry of some scenes. */
  type: "generate" | "scene_retry";
  userId: string;
  spec: VideoSpec;
  /** The draft's rev at the snapshot: the save keeps edits made after it. */
  baseRev: number;
  /** Only these scenes (a retry); all of them otherwise. */
  sceneIds: string[] | null;
};

export type NarrationStore = {
  /** Null when the project, its draft or the job is gone. */
  load(job: NarrationJob, type: "generate" | "scene_retry"): Promise<NarrationInputs | null>;
  /** The scenes the run works on and their first status. */
  setScenes(
    job: NarrationJob,
    scenes: { sceneId: string; status: JobSceneStatus }[],
  ): Promise<void>;
  markScene(
    job: NarrationJob,
    sceneId: string,
    update: { status: JobSceneStatus; attempts?: number; error?: SceneError },
  ): Promise<void>;
  /** The narration cache: a recording of this exact narration and voice, if there is one. */
  findRecording(job: NarrationJob, hash: string): Promise<Recording | null>;
  /**
   * Records a scene with the voice service, uploads the audio, stores the asset and its usage
   * event. Throws the voice service's error.
   */
  record(
    job: NarrationJob,
    task: NarrationTask,
    userId: string,
    attempt: number,
  ): Promise<Recording>;
  save(
    job: NarrationJob,
    spec: VideoSpec,
    inputs: NarrationInputs,
  ): Promise<{ versionNumber: number }>;
  recordModeration(job: NarrationJob, userId: string, result: ModerationResult): Promise<void>;
};

/** What the narration route keeps in a retry job's input. */
export const sceneRetryJobInput = z.object({
  baseRev: z.int().min(0),
  sceneIds: z.array(z.string().min(1)).min(1).max(10).nullable(),
});

const ids = (job: NarrationJob) => ({
  workspaceId: new ObjectId(job.workspaceId),
  projectId: new ObjectId(job.projectId),
  jobId: new ObjectId(job.jobId),
});
const ref = (job: NarrationJob) => ({
  workspaceId: new ObjectId(job.workspaceId),
  jobId: new ObjectId(job.jobId),
});

/**
 * The `assets` key of a recording. The stub's silent recordings get their own key, so turning
 * the live voice on never plays them back from the cache; the scene's `narrationHash` is the
 * same either way.
 */
export const cacheKey = (provider: TtsProvider["provider"], hash: string) =>
  provider === "stub" ? sha256Hex(`stub:${hash}`) : hash;

export function mongoNarrationStore(
  getDb: () => Db,
  services: { tts: () => TtsProvider; storage: () => ArtifactStore },
): NarrationStore {
  return {
    async load(job, type) {
      const snapshot = await readGenerateSnapshot(getDb(), ids(job));
      if (!snapshot) return null;
      const stored = await getJob(getDb(), ids(job).workspaceId, ids(job).jobId);
      const retry = type === "scene_retry" ? sceneRetryJobInput.parse(stored.input) : null;
      return {
        type,
        userId: snapshot.userId.toHexString(),
        spec: snapshot.spec,
        baseRev: snapshot.rev,
        sceneIds: retry?.sceneIds ?? null,
      };
    },
    async setScenes(job, scenes) {
      await setJobScenes(getDb(), ref(job), scenes);
    },
    async markScene(job, sceneId, update) {
      await markJobScene(getDb(), ref(job), sceneId, update);
    },
    async findRecording(job, hash) {
      const { provider } = services.tts();
      const key = cacheKey(provider, hash);
      const asset = await findAsset(getDb(), ids(job).workspaceId, "narration", key);
      if (!asset) return null;
      return {
        assetId: asset._id.toHexString(),
        hash,
        durationMs: asset.durationMs,
        words: asset.meta.words,
        timingSource: provider === "stub" ? "estimated" : "provider",
      };
    },
    async record(job, task, userId, attempt) {
      const tts = services.tts();
      const speech = await tts.synthesize({
        text: task.text,
        language: task.language,
        voiceId: task.voiceId,
        model: task.model,
        speed: task.speed,
      });
      const assetHash = cacheKey(tts.provider, task.hash);
      const key = narrationKey(job.workspaceId, assetHash);
      await services.storage().put(key, speech.audio, { contentType: speech.mime });
      const now = new Date();
      const { workspaceId, projectId, jobId } = ids(job);
      const { asset } = await recordAsset(getDb(), {
        _id: new ObjectId(),
        schemaVersion: 1,
        workspaceId,
        kind: "narration",
        hash: assetHash,
        r2Key: key,
        mime: "audio/mpeg",
        bytes: speech.audio.length,
        durationMs: speech.durationMs,
        meta: {
          text: task.text,
          language: task.language,
          voiceId: task.voiceId,
          model: task.model,
          speed: task.speed,
          characters: speech.characters,
          words: speech.words,
        },
        createdAt: now,
        lastUsedAt: now,
      });
      if (tts.provider !== "stub") {
        const cost = narrationCost(tts.provider, task.model, speech.characters);
        try {
          await recordUsage(getDb(), {
            workspaceId,
            projectId,
            jobId,
            userId: new ObjectId(userId),
            provider: tts.provider,
            operation: "narration",
            model: task.model,
            units: { characters: speech.characters },
            cached: false,
            ...cost,
            attempt,
          });
        } catch (error) {
          console.error("[narration] Couldn't record a usage event", error);
        }
      }
      return {
        assetId: asset._id.toHexString(),
        hash: task.hash,
        durationMs: asset.durationMs,
        words: asset.meta.words,
        timingSource: speech.timingSource,
      };
    },
    async save(job, spec, inputs) {
      const saved = await saveGeneratedVersion(getDb(), ids(job), {
        spec,
        baseRev: inputs.baseRev,
        userId: new ObjectId(inputs.userId),
        kind: inputs.type === "scene_retry" ? "retry" : "generate",
      });
      await touchSpecAudio(getDb(), ids(job).workspaceId, spec);
      return saved;
    },
    async recordModeration(job, userId, result) {
      const { workspaceId, projectId } = ids(job);
      await recordModeration(getDb(), {
        workspaceId,
        projectId,
        userId: new ObjectId(userId),
        inputKind: result.decision === "block" ? result.input.kind : "script",
        decision: result.decision,
        ...(result.decision === "block"
          ? { category: result.category, reason: result.reason }
          : {}),
        text: result.decision === "block" ? result.input.text : "",
        model: result.model,
      });
    },
  };
}
