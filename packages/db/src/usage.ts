// Usage limits (DB §4, §11; SDD §15 "Reserve, commit, release"). Reading them for the app, and
// the monthly video counter's reservation: a video is reserved before generation starts,
// committed when the first generation saves a version (`saveGeneratedVersion`), and released
// when it fails or is cancelled, so failures never use up anyone's allowance.
import { toUsageDto, type UsageDto } from "@vidcosmos/spec/api";
import type { Workspace } from "@vidcosmos/spec/collections";
import { istPeriod, nextIstMonthStart } from "@vidcosmos/spec/time";
import type { Db, ObjectId } from "mongodb";
import { JobError } from "./job-error.ts";
import { workspaceCollection } from "./scoped.ts";

/** Jobs that count against the concurrent-jobs limit: queued or running (DB §4). */
export function activeJobCount(db: Db, workspace: Pick<Workspace, "_id">): Promise<number> {
  return workspaceCollection(db, "jobs").countDocuments({
    workspaceId: workspace._id,
    status: { $in: ["queued", "running"] },
  });
}

/** Usage against the workspace's limits now, in this IST month and day. */
export async function readUsage(db: Db, workspace: Workspace, now = new Date()): Promise<UsageDto> {
  return toUsageDto(workspace, now, await activeJobCount(db, workspace));
}

/**
 * Reserves one video of this IST month, or refuses: `403 WORKSPACE_BLOCKED` for a blocked
 * workspace, `403 LIMIT_REACHED` when used plus reserved has reached the limit. One update both
 * starts a new month when needed and checks the limit (DB §11), so two requests at once can
 * never both take the last video.
 */
export async function reserveVideo(db: Db, workspaceId: ObjectId, now = new Date()): Promise<void> {
  const { periodKey, periodStart } = istPeriod(now);
  const reserved = await workspaceCollection(db, "workspaces").updateOne(
    {
      _id: workspaceId,
      "flags.blocked": false,
      $expr: {
        $or: [
          { $ne: ["$usage.periodKey", periodKey] },
          {
            $lt: [
              { $add: ["$usage.videosUsed", "$usage.videosReserved"] },
              "$limits.videosPerMonth",
            ],
          },
        ],
      },
    },
    [
      {
        $set: {
          usage: {
            $cond: [
              { $ne: ["$usage.periodKey", periodKey] },
              {
                periodKey,
                periodStart,
                videosUsed: 0,
                videosReserved: 1,
                exportsDayKey: "$usage.exportsDayKey",
                exportsToday: "$usage.exportsToday",
              },
              {
                $mergeObjects: [
                  "$usage",
                  { videosReserved: { $add: ["$usage.videosReserved", 1] } },
                ],
              },
            ],
          },
          updatedAt: now,
        },
      },
    ],
  );
  if (reserved.matchedCount === 1) return;
  const workspace = await workspaceCollection(db, "workspaces").findOne({ _id: workspaceId });
  if (workspace?.flags.blocked) {
    throw new JobError("WORKSPACE_BLOCKED", "This account can't make videos right now.");
  }
  const max = workspace?.limits.videosPerMonth ?? 0;
  throw new JobError(
    "LIMIT_REACHED",
    `You've made all ${max} videos for this month. More are available from ${nextIstMonthStart(now).toISOString().slice(0, 10)}.`,
    {
      limit: "videosPerMonth",
      used: workspace?.usage.videosUsed ?? max,
      max,
      resetsAt: nextIstMonthStart(now).toISOString(),
    },
  );
}

/**
 * Gives a reserved video back (a generation failed or was cancelled). Never below zero: after
 * a month rollover the old month's reservations are already gone.
 */
export async function releaseVideo(db: Db, workspaceId: ObjectId, now = new Date()): Promise<void> {
  await workspaceCollection(db, "workspaces").updateOne(
    { _id: workspaceId, "usage.videosReserved": { $gt: 0 } },
    { $inc: { "usage.videosReserved": -1 }, $set: { updatedAt: now } },
  );
}
