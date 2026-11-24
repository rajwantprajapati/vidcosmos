// F21: the editor's timeline: scene start frames, the scene at a frame, and times as shown.
import { exampleScenes } from "@vidcosmos/spec/video";
import { testSpec } from "@vidcosmos/spec/video/testing";
import { describe, expect, it } from "vitest";
import { clock, sceneIndexAt, seconds, timelineOf } from "./timeline";

describe("the timeline", () => {
  it("starts each scene where the one before ends, from its recorded length", () => {
    const spec = testSpec([exampleScenes.title, exampleScenes.recap], { timed: true });
    const timeline = timelineOf(spec);
    const lengthOf = (i: number) => Math.round((spec.scenes[i]!.timing!.durationMs / 1000) * 30);
    expect(timeline.starts).toEqual([0, lengthOf(0)]);
    expect(timeline.lengths).toEqual([lengthOf(0), lengthOf(1)]);
    expect(timeline.total).toBe(lengthOf(0) + lengthOf(1));
  });

  it("finds the scene playing at a frame", () => {
    const timeline = { starts: [0, 100, 250], lengths: [100, 150, 90], total: 340 };
    expect(sceneIndexAt(timeline, 0)).toBe(0);
    expect(sceneIndexAt(timeline, 99)).toBe(0);
    expect(sceneIndexAt(timeline, 100)).toBe(1);
    expect(sceneIndexAt(timeline, 339)).toBe(2);
    expect(sceneIndexAt(timeline, 400)).toBe(2);
  });

  it("writes times as the editor shows them", () => {
    expect(clock(19_400)).toBe("0:19");
    expect(clock(65_000)).toBe("1:05");
    expect(clock(-5)).toBe("0:00");
    expect(seconds(5_240)).toBe("5.2 s");
    expect(seconds(7_000)).toBe("7.0 s");
  });
});
