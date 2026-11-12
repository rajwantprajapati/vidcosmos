import type { Project } from "@vidcosmos/spec/collections";
import { ObjectId } from "@vidcosmos/db";
import { describe, expect, it } from "vitest";
import { formatDuration, libraryCard, projectHref } from "./library";

const id = new ObjectId("6740a1b2c3d4e5f601234567");

function project(overrides: Partial<Project> = {}): Project {
  const now = new Date("2026-11-12T06:00:00Z");
  return {
    _id: id,
    schemaVersion: 1,
    workspaceId: new ObjectId(),
    createdBy: new ObjectId(),
    title: "How UPI moves money",
    stage: "draft",
    wizardStep: "idea",
    settings: {
      format: "9:16",
      language: "en",
      voiceGender: "female",
      voiceSpeed: 1,
      tone: "friendly",
      audienceLevel: "beginner",
      lengthSec: 60,
      palette: "ocean",
      captionStyle: "highlight",
      musicTrackId: null,
    },
    idea: { topic: "How UPI moves money", videoType: "product_ad", angles: [] },
    script: null,
    draft: { spec: null, rev: 0, updatedAt: now, updatedBy: new ObjectId() },
    currentVersion: null,
    countedAt: null,
    revisionsUsed: 0,
    generationsUsed: 0,
    stageHashes: {},
    activeJobId: null,
    lease: null,
    thumbnailKey: null,
    lastExportId: null,
    lastOpenedAt: now,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

describe("formatDuration", () => {
  it.each([
    [56_000, "0:56"],
    [80_000, "1:20"],
    [59_600, "1:00"],
    [5_000, "0:05"],
  ])("%d ms -> %s", (ms, text) => expect(formatDuration(ms)).toBe(text));
});

describe("projectHref", () => {
  const base = `/projects/${id.toHexString()}`;
  it.each([
    ["draft", "idea", `${base}/idea`],
    ["draft", "angles", `${base}/idea`],
    ["draft", "script", `${base}/script`],
    ["draft", "storyboard", `${base}/storyboard`],
    ["generating", "video", `${base}/generating`],
    ["ready", "video", base],
    ["revising", "video", base],
    ["failed", "video", base],
  ] as const)("%s at %s opens %s", (stage, wizardStep, href) => {
    expect(projectHref(project({ stage, wizardStep }))).toBe(href);
  });
});

describe("libraryCard", () => {
  it("a draft shows its step, type and theme", () => {
    expect(libraryCard(project({ wizardStep: "script" }))).toMatchObject({
      title: "How UPI moves money",
      type: "Product ad",
      status: "draft",
      statusLabel: "Draft · script",
      theme: "ocean",
      aspect: "9:16",
    });
  });

  it("a generating video shows its job's progress, short on phones", () => {
    const card = libraryCard(project({ stage: "generating" }), { progress: 61.6 });
    expect(card).toMatchObject({
      status: "generating",
      statusLabel: "Generating 62%",
      shortStatusLabel: "62%",
      progress: 62,
    });
    expect(libraryCard(project({ stage: "generating" })).statusLabel).toBe("Generating");
  });

  it("a ready video shows its length once every scene has timing", () => {
    const spec = {
      version: 1 as const,
      scenes: [
        { id: "a", timing: { durationMs: 30_000 } },
        { id: "b", timing: { durationMs: 26_000 } },
      ],
    };
    const ready = libraryCard(project({ stage: "ready", draft: { ...project().draft, spec } }));
    expect(ready).toMatchObject({ status: "ready", duration: "0:56" });
    expect(ready.statusLabel).toBeUndefined();

    const partial = { version: 1 as const, scenes: [{ id: "a", timing: null }] };
    expect(
      libraryCard(project({ draft: { ...project().draft, spec: partial } })).duration,
    ).toBeUndefined();
  });

  it("failed, revising and Trash", () => {
    expect(libraryCard(project({ stage: "failed" })).statusLabel).toBe("Failed");
    expect(libraryCard(project({ stage: "revising" }))).toMatchObject({
      status: "generating",
      statusLabel: "Updating",
    });
    const deleted = libraryCard(project({ deletedAt: new Date("2026-11-11T00:00:00Z") }));
    expect(deleted).toMatchObject({
      statusLabel: "In Trash",
      deletedAt: "2026-11-11T00:00:00.000Z",
    });
  });

  it("projects made before D1 show as explainers", () => {
    const old = project({ idea: { topic: "x y z", angles: [] } });
    expect(libraryCard(old).type).toBe("Explainer");
  });
});
