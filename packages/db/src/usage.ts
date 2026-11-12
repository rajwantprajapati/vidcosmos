// The read side of usage limits (DB §4, API §3 Usage). Reservation, commit and release, which
// change the counters, arrive with generation (F20).
import { toUsageDto, type UsageDto } from "@vidcosmos/spec/api";
import type { Workspace } from "@vidcosmos/spec/collections";
import type { Db } from "mongodb";
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
