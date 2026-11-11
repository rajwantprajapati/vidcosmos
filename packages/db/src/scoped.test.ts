// The typed collection helper refuses any query that does not name its workspace, and one
// workspace never sees another's documents (DB §13 "Tenant isolation").
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.ts";
import { workspaceCollection, WorkspaceScopeError } from "./scoped.ts";
import { sampleDocuments } from "./testing/samples.ts";
import { useTestDatabase } from "./testing/database.ts";

const database = useTestDatabase();
const mine = sampleDocuments();
const theirs = sampleDocuments();
const myWorkspace = mine.workspaces._id;
const theirWorkspace = theirs.workspaces._id;

beforeAll(async () => {
  const db = database.get();
  await migrate(db);
  for (const samples of [mine, theirs]) {
    await workspaceCollection(db, "workspaces").insertOne(samples.workspaces);
    await workspaceCollection(db, "projects").insertOne(samples.projects);
    await workspaceCollection(db, "jobs").insertOne(samples.jobs);
  }
});

const projects = () => workspaceCollection(database.get(), "projects");

describe("workspaceCollection refuses unscoped queries", () => {
  // Each of these is what a bug or a missing session could produce. The casts stand in for
  // untyped callers: TypeScript already rejects every one of them.
  const unscoped: [string, unknown][] = [
    ["an empty filter", {}],
    ["a filter without workspaceId", { _id: mine.projects._id }],
    ["workspaceId undefined (no session)", { workspaceId: undefined }],
    ["workspaceId as a string", { workspaceId: myWorkspace.toHexString() }],
    ["workspaceId as an operator", { workspaceId: { $exists: true } }],
    ["workspaceId inside $or only", { $or: [{ workspaceId: myWorkspace }, { title: "x" }] }],
  ];

  it.each(unscoped)("findOne with %s", async (_label, filter) => {
    expect(() => projects().findOne(filter as never)).toThrow(WorkspaceScopeError);
  });

  it.each(unscoped)("find, count, update and delete with %s", (_label, filter) => {
    const collection = projects();
    expect(() => collection.find(filter as never)).toThrow(WorkspaceScopeError);
    expect(() => collection.countDocuments(filter as never)).toThrow(WorkspaceScopeError);
    expect(() => collection.updateOne(filter as never, { $set: { title: "x" } })).toThrow(
      WorkspaceScopeError,
    );
    expect(() => collection.updateMany(filter as never, { $set: { title: "x" } })).toThrow(
      WorkspaceScopeError,
    );
    expect(() => collection.findOneAndUpdate(filter as never, { $set: { title: "x" } })).toThrow(
      WorkspaceScopeError,
    );
    expect(() => collection.deleteOne(filter as never)).toThrow(WorkspaceScopeError);
    expect(() => collection.deleteMany(filter as never)).toThrow(WorkspaceScopeError);
  });

  it("aggregate without a first $match on the workspace", () => {
    expect(() => projects().aggregate([{ $sort: { updatedAt: -1 } }] as never)).toThrow(
      WorkspaceScopeError,
    );
    expect(() => projects().aggregate([{ $match: {} }] as never)).toThrow(WorkspaceScopeError);
  });

  it("workspaces are scoped by their own _id", () => {
    const workspaces = workspaceCollection(database.get(), "workspaces");
    expect(() => workspaces.findOne({ ownerId: mine.workspaces.ownerId } as never)).toThrow(
      WorkspaceScopeError,
    );
  });

  it("a collection without workspaceId cannot be used through the helper", () => {
    expect(() => workspaceCollection(database.get(), "admin_audit" as never)).toThrow(
      WorkspaceScopeError,
    );
  });
});

describe("workspaceCollection keeps workspaces apart", () => {
  it("finds a document in its own workspace", async () => {
    const found = await projects().findOne({ workspaceId: myWorkspace, _id: mine.projects._id });
    expect(found?.title).toBe(mine.projects.title);
  });

  it("finds nothing when the id belongs to another workspace", async () => {
    const found = await projects().findOne({ workspaceId: myWorkspace, _id: theirs.projects._id });
    expect(found).toBeNull();
  });

  it("counts and lists only its own workspace", async () => {
    expect(await projects().countDocuments({ workspaceId: myWorkspace })).toBe(1);
    const titles = await projects()
      .find({ workspaceId: theirWorkspace })
      .map((p) => p._id.toHexString())
      .toArray();
    expect(titles).toEqual([theirs.projects._id.toHexString()]);
  });

  it("cannot update or delete another workspace's document", async () => {
    const update = await projects().updateOne(
      { workspaceId: myWorkspace, _id: theirs.projects._id },
      { $set: { title: "Taken over" } },
    );
    expect(update.matchedCount).toBe(0);
    const removed = await projects().deleteOne({
      workspaceId: myWorkspace,
      _id: theirs.projects._id,
    });
    expect(removed.deletedCount).toBe(0);
    const theirsNow = await projects().findOne({
      workspaceId: theirWorkspace,
      _id: theirs.projects._id,
    });
    expect(theirsNow?.title).toBe(theirs.projects.title);
  });

  it("aggregates only its own workspace", async () => {
    const stages = await workspaceCollection(database.get(), "jobs")
      .aggregate<{ _id: string; n: number }>([
        { $match: { workspaceId: myWorkspace } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ])
      .toArray();
    expect(stages).toEqual([{ _id: "partial", n: 1 }]);
  });

  it("refuses updates that would move a document to another workspace", () => {
    const filter = { workspaceId: myWorkspace, _id: mine.projects._id };
    expect(() => projects().updateOne(filter, { $set: { workspaceId: theirWorkspace } })).toThrow(
      WorkspaceScopeError,
    );
    expect(() => projects().updateOne(filter, { $unset: { workspaceId: "" } })).toThrow(
      WorkspaceScopeError,
    );
    expect(() => projects().updateOne(filter, [{ $set: { workspaceId: theirWorkspace } }])).toThrow(
      WorkspaceScopeError,
    );
  });

  it("parses inserts with the zod schema", () => {
    const invalid = { ...sampleDocuments(myWorkspace).projects, stage: "done" };
    expect(() => projects().insertOne(invalid as never)).toThrow(/stage/);
  });

  it("inserts a valid document", async () => {
    const project = { ...sampleDocuments(myWorkspace).projects, _id: new ObjectId() };
    await projects().insertOne(project);
    expect(await projects().countDocuments({ workspaceId: myWorkspace })).toBe(2);
  });
});
