// Every collection schema compiles, and a sample document round-trips through zod and
// through MongoDB with the generated validator in place.
import { collectionNames, collectionSchemas, objectId } from "@vidcosmos/spec/collections";
import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it } from "vitest";
import { migrate } from "./migrate.ts";
import { systemCollection } from "./scoped.ts";
import { sampleDocuments } from "./testing/samples.ts";
import { useTestDatabase } from "./testing/database.ts";

const database = useTestDatabase();
const samples = sampleDocuments();

beforeAll(async () => {
  await migrate(database.get());
});

describe("collection schemas", () => {
  it("accept ObjectIds from the driver, and nothing else", () => {
    expect(objectId.safeParse(new ObjectId()).success).toBe(true);
    expect(objectId.safeParse("6740a1b2c3d4e5f601234567").success).toBe(false);
    expect(objectId.safeParse({ $oid: "6740a1b2c3d4e5f601234567" }).success).toBe(false);
  });

  it.each(collectionNames)("%s: the sample parses unchanged", (name) => {
    expect(collectionSchemas[name].parse(samples[name])).toEqual(samples[name]);
  });

  it.each(collectionNames)("%s: the sample round-trips through MongoDB", async (name) => {
    const collection = systemCollection(database.get(), name);
    // The schema union makes insertOne's parameter type unwieldy; the value is a parsed sample.
    await collection.insertOne(samples[name] as never);
    const stored = await collection.findOne({ _id: samples[name]._id } as never);
    expect(collectionSchemas[name].parse(stored)).toEqual(samples[name]);
  });
});

describe("MongoDB validators", () => {
  it("reject a document missing a required field", async () => {
    const { title: _title, ...withoutTitle } = sampleDocuments().projects;
    const insert = systemCollection(database.get(), "projects").insertOne(withoutTitle as never);
    await expect(insert).rejects.toMatchObject({ code: 121 }); // DocumentValidationFailure
  });

  it("reject a field of the wrong BSON type", async () => {
    const project = { ...sampleDocuments().projects, workspaceId: "not-an-object-id" };
    const insert = systemCollection(database.get(), "projects").insertOne(project as never);
    await expect(insert).rejects.toMatchObject({ code: 121 });
  });

  it("reject a value outside an enum", async () => {
    const job = { ...sampleDocuments().jobs, status: "done" };
    const insert = systemCollection(database.get(), "jobs").insertOne(job as never);
    await expect(insert).rejects.toMatchObject({ code: 121 });
  });

  it("allow fields the schema does not know (old and new shapes during a migration)", async () => {
    const asset = { ...sampleDocuments().assets, futureField: true };
    await expect(
      systemCollection(database.get(), "assets").insertOne(asset as never),
    ).resolves.toMatchObject({ acknowledged: true });
  });
});
