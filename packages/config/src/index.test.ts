import { describe, expect, it } from "vitest";
import { configPackage } from "./index";

describe("@vidcosmos/config", () => {
  it("exports its package name", () => {
    expect(configPackage).toBe("@vidcosmos/config");
  });
});
