// Typed revision operations (SDD §10, DB §6): the closed set of changes a chat proposal (or
// the editor) can make to a spec. Unknown fields are refused, not dropped: they come from LLM
// proposals. They address scenes by id, never by position, so they stay
// right when scenes move. `applyOperations` applies them to a copy, validates the result and
// says which scenes changed and which need new audio: a scene whose narration or voice
// changed loses its timing (its `narrationHash` no longer matches); everything else keeps it.
// `setFormat` changes only layout, so every recording is kept.
import { randomBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { videoFormat } from "../collections/common.ts";
import { reconcileTiming, type SpecIssue, specIssues } from "./checks.ts";
import { sceneId, specMusic, type VideoSpec, videoSpec } from "./schema.ts";
import { templateNames, type TemplateName } from "./templates.ts";

const template = z.enum(templateNames as [TemplateName, ...TemplateName[]]);
const content = z.record(z.string(), z.unknown());
const narration = z.string().trim().min(1).max(400);

/** A scene's new words and look. A new template must come with its content. */
const sceneChange = {
  narration: narration.optional(),
  template: template.optional(),
  content: content.optional(),
};
type SceneChange = {
  narration?: string;
  template?: TemplateName;
  content?: Record<string, unknown>;
};

export const specOperation = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("updateScene"), sceneId, ...sceneChange }),
  z.strictObject({
    op: z.literal("addScene"),
    /** Null: the new scene goes first. */
    afterSceneId: sceneId.nullable(),
    scene: z.strictObject({ id: sceneId.optional(), template, narration, content }),
  }),
  z.strictObject({ op: z.literal("removeScene"), sceneId }),
  z.strictObject({ op: z.literal("moveScene"), sceneId, afterSceneId: sceneId.nullable() }),
  z.strictObject({ op: z.literal("setFormat"), format: videoFormat }),
  z.strictObject({
    op: z.literal("setTheme"),
    palette: z.enum(["midnight", "paper", "ocean", "sunset"]).optional(),
    captionStyle: z.enum(["highlight", "classic", "none"]).optional(),
  }),
  z.strictObject({
    op: z.literal("setVoice"),
    gender: z.enum(["female", "male"]).optional(),
    voiceId: z.string().min(1).max(64).optional(),
    speed: z.number().min(0.85).max(1.15).optional(),
  }),
  z.strictObject({
    op: z.literal("setMusic"),
    /** Null: no music. */
    music: specMusic.nullable(),
  }),
  z.strictObject({
    op: z.literal("rewriteAll"),
    /** Every scene, once each: its new narration, and its template and content if they change. */
    scenes: z.array(z.strictObject({ sceneId, ...sceneChange })).min(1),
  }),
]);
export type SpecOperation = z.infer<typeof specOperation>;

/** An operation that can't apply: an unknown scene, or a result that breaks the schema. */
export class SpecOperationError extends Error {
  readonly operationIndex: number | null;
  constructor(message: string, operationIndex: number | null = null) {
    super(message);
    this.name = "SpecOperationError";
    this.operationIndex = operationIndex;
  }
}

export type AppliedOperations = {
  spec: VideoSpec;
  /** Scenes whose words, template, content or place changed. */
  affectedSceneIds: string[];
  /** Scenes without audio for their current narration and voice: new, or no longer matching. */
  needsNarration: string[];
  /** The semantic rules for the result (triggers, ids, length): warnings, not refusals. */
  issues: SpecIssue[];
};

const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";

/** "sc_" and 8 random characters (DB §6). */
export function newSceneId(): string {
  const bytes = randomBytes(8);
  return `sc_${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("")}`;
}

type Scene = VideoSpec["scenes"][number];

function changeScene(current: Scene, change: SceneChange, at: number): unknown {
  if (change.template !== undefined && change.template !== current.template && !change.content) {
    throw new SpecOperationError(`A new template for "${current.id}" needs its content.`, at);
  }
  const next = {
    ...current,
    ...(change.narration !== undefined ? { narration: change.narration } : {}),
    ...(change.template !== undefined ? { template: change.template } : {}),
    ...(change.content !== undefined ? { content: change.content } : {}),
  };
  return next;
}

/**
 * Applies `operations` in order to a copy of `spec`. Throws `SpecOperationError` when one
 * can't apply or the result isn't a valid spec; nothing is changed then.
 */
export function applyOperations(
  spec: VideoSpec,
  operations: SpecOperation[],
  options: { newId?: () => string } = {},
): AppliedOperations {
  const makeId = options.newId ?? newSceneId;
  // A spec is plain JSON, so this is a full copy.
  let working = JSON.parse(JSON.stringify(spec)) as VideoSpec;
  const affected = new Set<string>();
  const added = new Set<string>();

  const indexOf = (id: string, at: number) => {
    const index = working.scenes.findIndex((s) => s.id === id);
    if (index === -1) throw new SpecOperationError(`There's no scene "${id}".`, at);
    return index;
  };
  const insertAfter = (item: Scene, afterId: string | null, at: number) => {
    const position = afterId === null ? 0 : indexOf(afterId, at) + 1;
    working.scenes.splice(position, 0, item);
  };

  operations.forEach((operation, at) => {
    switch (operation.op) {
      case "updateScene": {
        const index = indexOf(operation.sceneId, at);
        working.scenes[index] = changeScene(working.scenes[index]!, operation, at) as Scene;
        affected.add(operation.sceneId);
        break;
      }
      case "addScene": {
        const taken = new Set(working.scenes.map((s) => s.id));
        let id = operation.scene.id ?? makeId();
        if (taken.has(id)) {
          if (operation.scene.id) {
            throw new SpecOperationError(`A scene "${id}" already exists.`, at);
          }
          while (taken.has(id)) id = makeId();
        }
        insertAfter(
          { ...operation.scene, id, userEdited: false, timing: null } as Scene,
          operation.afterSceneId,
          at,
        );
        affected.add(id);
        added.add(id);
        break;
      }
      case "removeScene": {
        working.scenes.splice(indexOf(operation.sceneId, at), 1);
        affected.delete(operation.sceneId);
        added.delete(operation.sceneId);
        break;
      }
      case "moveScene": {
        if (operation.afterSceneId === operation.sceneId) {
          throw new SpecOperationError("A scene can't move after itself.", at);
        }
        const [moved] = working.scenes.splice(indexOf(operation.sceneId, at), 1);
        insertAfter(moved!, operation.afterSceneId, at);
        affected.add(operation.sceneId);
        break;
      }
      case "setFormat":
        working = { ...working, format: operation.format };
        break;
      case "setTheme":
        working = {
          ...working,
          theme: {
            palette: operation.palette ?? working.theme.palette,
            captionStyle: operation.captionStyle ?? working.theme.captionStyle,
          },
        };
        break;
      case "setVoice":
        // The voice id is the narrator: a new gender without one would claim a voice the
        // audio isn't in (and `narrationHash` wouldn't ask for new audio).
        if (
          operation.gender !== undefined &&
          operation.gender !== working.voice.gender &&
          operation.voiceId === undefined
        ) {
          throw new SpecOperationError("A new narrator needs its voice id.", at);
        }
        working = {
          ...working,
          voice: {
            ...working.voice,
            ...(operation.gender !== undefined ? { gender: operation.gender } : {}),
            ...(operation.voiceId !== undefined ? { voiceId: operation.voiceId } : {}),
            ...(operation.speed !== undefined ? { speed: operation.speed } : {}),
          },
        };
        break;
      case "setMusic":
        working = { ...working, music: operation.music };
        break;
      case "rewriteAll": {
        const ids = operation.scenes.map((s) => s.sceneId);
        const current = working.scenes.map((s) => s.id);
        const sameSet =
          ids.length === current.length &&
          new Set(ids).size === ids.length &&
          ids.every((id) => current.includes(id));
        if (!sameSet) {
          throw new SpecOperationError("A rewrite of every scene must name each scene once.", at);
        }
        for (const change of operation.scenes) {
          const index = indexOf(change.sceneId, at);
          working.scenes[index] = changeScene(working.scenes[index]!, change, at) as Scene;
          affected.add(change.sceneId);
        }
        break;
      }
    }
  });

  const parsed = videoSpec.safeParse(working);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    throw new SpecOperationError(
      `The changed video isn't valid. ${where}${first?.message ?? "Unknown problem."}`,
    );
  }
  const { spec: reconciled, cleared } = reconcileTiming(parsed.data);
  const needsNarration = reconciled.scenes
    .filter((s) => s.timing === null && (cleared.includes(s.id) || added.has(s.id)))
    .map((s) => s.id);
  return {
    spec: reconciled,
    affectedSceneIds: reconciled.scenes.map((s) => s.id).filter((id) => affected.has(id)),
    needsNarration,
    issues: specIssues(reconciled),
  };
}
