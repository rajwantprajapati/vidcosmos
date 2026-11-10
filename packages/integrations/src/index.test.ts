import { describe, expect, it } from "vitest";
import { packageName } from "./index";

describe("@vidcosmos/integrations", () => {
  it("exports its package name", () => {
    expect(packageName).toBe("@vidcosmos/integrations");
  });
});
