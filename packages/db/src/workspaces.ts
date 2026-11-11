// Creating a user's workspace (DB §4). In V1 each user owns exactly one, created in the
// sign-up request; `ensureWorkspace` also creates it on first use if that step ever failed.
import type { Workspace } from "@vidcosmos/spec/collections";
import { type Db, ObjectId } from "mongodb";
import { systemCollection, workspaceCollection } from "./scoped.ts";

/** India Standard Time is UTC+5:30 all year (no daylight saving). */
const istOffsetMs = (5 * 60 + 30) * 60 * 1000;

/** The IST calendar month and day of an instant, and when that month started (in UTC). */
export function istPeriod(now: Date): { periodKey: string; periodStart: Date; dayKey: string } {
  const ist = new Date(now.getTime() + istOffsetMs);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    periodKey: `${year}-${pad(month + 1)}`,
    periodStart: new Date(Date.UTC(year, month, 1) - istOffsetMs),
    dayKey: `${year}-${pad(month + 1)}-${pad(ist.getUTCDate())}`,
  };
}

/** Default limits for a beta workspace (DB §4); an admin can change them per workspace. */
export const defaultLimits: Workspace["limits"] = {
  videosPerMonth: 20,
  revisionsPerVideo: 30,
  generationsPerVideo: 50,
  exportsPerDay: 20,
  concurrentJobs: 2,
};

/** Defaults for new videos. Onboarding (F07) sets the language and narrator. */
export const defaultVideoDefaults: Workspace["defaults"] = {
  format: "9:16",
  language: "en",
  voiceGender: "female",
  tone: "friendly",
  audienceLevel: "beginner",
  lengthSec: 60,
  palette: "midnight",
  captionStyle: "highlight",
  musicTrackId: null,
};

/** "Asha's workspace" from "Asha Rao"; "My workspace" when there is no usable name. */
export function workspaceName(ownerName: string): string {
  const first = ownerName.trim().split(/\s+/)[0] ?? "";
  if (!first) return "My workspace";
  const name = `${first}'s workspace`;
  return name.length <= 60 ? name : "My workspace";
}

export function newWorkspace(ownerId: ObjectId, ownerName: string, now: Date): Workspace {
  const { periodKey, periodStart, dayKey } = istPeriod(now);
  return {
    _id: new ObjectId(),
    schemaVersion: 1,
    ownerId,
    name: workspaceName(ownerName),
    plan: "free",
    defaults: { ...defaultVideoDefaults },
    limits: { ...defaultLimits },
    usage: {
      periodKey,
      periodStart,
      videosUsed: 0,
      videosReserved: 0,
      exportsDayKey: dayKey,
      exportsToday: 0,
    },
    flags: { blocked: false },
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The owner's workspace, created if it does not exist yet. Safe to call from two requests
 * at once: the unique index on `ownerId` lets one insert win, and the other reads it.
 */
export async function ensureWorkspace(
  db: Db,
  owner: { id: ObjectId; name: string },
  now = new Date(),
): Promise<Workspace> {
  // Looking a workspace up by its owner is how a session finds its workspace, so it is
  // the one query that cannot already name the workspace.
  const workspaces = systemCollection(db, "workspaces");
  const existing = await workspaces.findOne({ ownerId: owner.id });
  if (existing) return existing;

  const workspace = newWorkspace(owner.id, owner.name, now);
  try {
    await workspaceCollection(db, "workspaces").insertOne(workspace);
    return workspace;
  } catch (error) {
    if ((error as { code?: number }).code !== 11000) throw error;
    const winner = await workspaces.findOne({ ownerId: owner.id });
    if (!winner) throw error;
    return winner;
  }
}
