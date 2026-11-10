import { describe, expect, it } from "vitest";
import { appInfo } from "./app-info";

describe("appInfo", () => {
  it("has the product name and tagline", () => {
    expect(appInfo.name).toBe("Vidcosmos");
    expect(appInfo.tagline).toBe("A universe of videos, made by AI.");
  });
});
