import { describe, expect, it } from "vitest";
import { packageName } from "./index";

describe("@vidcosmos/spec", () => {
  it("exports its package name", () => {
    expect(packageName).toBe("@vidcosmos/spec");
  });
});
