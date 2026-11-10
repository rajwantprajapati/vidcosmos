import { describe, expect, it } from "vitest";
import { packageName } from "./index";

describe("@vidcosmos/video", () => {
  it("exports its package name", () => {
    expect(packageName).toBe("@vidcosmos/video");
  });
});
