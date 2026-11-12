// F11 QA fix: a job whose start event didn't reach Inngest gets it again when it's read or
// its request replayed, so it runs once Inngest is back, instead of holding its video.
import type * as DbModule from "@vidcosmos/db";
import type { Job } from "@vidcosmos/spec/collections";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ getDb: vi.fn(() => ({})) }));
const send = vi.fn();
vi.mock("@/inngest/client", () => ({ inngest: { send: (event: unknown) => send(event) } }));
const claimStartResend = vi.fn();
const getJob = vi.fn();
vi.mock("@vidcosmos/db", () => ({
  claimStartResend: (...args: unknown[]) => claimStartResend(...args),
  getJob: (...args: unknown[]) => getJob(...args),
}));

const { resendIfWaiting, sendStart, startedResponse } = await import("./jobs");
const { ObjectId } = await vi.importActual<typeof DbModule>("@vidcosmos/db");

const queued = (extra: Partial<Job> = {}): Job => ({
  _id: new ObjectId(),
  schemaVersion: 1,
  workspaceId: new ObjectId(),
  projectId: new ObjectId(),
  userId: new ObjectId(),
  type: "demo",
  status: "queued",
  progress: 0,
  input: { mode: "succeed" },
  inngest: { eventId: "job-x" },
  usage: { reserved: false, committed: false, released: false },
  attempts: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("start events", () => {
  it("keeps the job queued when Inngest is unreachable", async () => {
    send.mockRejectedValueOnce(new Error("connect ECONNREFUSED 127.0.0.1:8288"));
    expect(await sendStart(queued())).toBe(false);
  });

  it("re-sends with the same event id for a waiting job, then the run can start", async () => {
    const job = queued();
    claimStartResend.mockResolvedValueOnce(true);
    send.mockResolvedValueOnce({ ids: ["1"] });
    await resendIfWaiting(job);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "job/demo.requested",
        id: `job-${job._id.toHexString()}`,
        data: expect.objectContaining({ jobId: job._id.toHexString(), mode: "succeed" }),
      }),
    );
  });

  it("doesn't re-send inside the interval, or for jobs that started or were asked to stop", async () => {
    claimStartResend.mockResolvedValue(false);
    await resendIfWaiting(queued());
    claimStartResend.mockResolvedValue(true);
    await resendIfWaiting(queued({ status: "running", startedAt: new Date() }));
    await resendIfWaiting(queued({ cancelRequestedAt: new Date() }));
    await resendIfWaiting(queued({ status: "cancelled" }));
    expect(send).not.toHaveBeenCalled();
    expect(claimStartResend).toHaveBeenCalledTimes(1);
  });

  it("a replayed start re-sends for a waiting job; a new one sends at once", async () => {
    const job = queued();
    const owner = { workspaceId: job.workspaceId, userId: job.userId };
    getJob.mockResolvedValue(job);
    claimStartResend.mockResolvedValue(true);
    send.mockResolvedValue({ ids: ["1"] });

    const replay = await startedResponse(owner, job._id, true);
    expect(replay.status).toBe(202);
    expect(replay.headers.get("Idempotent-Replayed")).toBe("true");
    expect(claimStartResend).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(1);

    await startedResponse(owner, job._id, false);
    expect(claimStartResend).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
