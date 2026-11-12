import { describe, expect, it } from "vitest";
import { initialsOf, isCurrent, library, newVideo, posts, settings } from "./nav";

describe("isCurrent", () => {
  it("marks a section on its page and the pages under it", () => {
    expect(isCurrent(posts, "/posts")).toBe(true);
    expect(isCurrent(settings, "/settings/profile")).toBe(true);
    expect(isCurrent(posts, "/postsx")).toBe(false);
  });

  it("counts project pages as the library, except New video", () => {
    expect(isCurrent(library, "/projects/6740a1b2c3d4e5f601234567/script")).toBe(true);
    expect(isCurrent(library, "/projects/new")).toBe(false);
    expect(isCurrent(newVideo, "/projects/new")).toBe(true);
    expect(isCurrent(newVideo, "/library")).toBe(false);
  });

  it("marks nothing on a path that can't be a page", () => {
    expect(isCurrent(library, "/projects/not-an-id")).toBe(false);
    expect(isCurrent(newVideo, "/projects/new/idea")).toBe(false);
    expect(isCurrent(library, "/projects/new/idea")).toBe(false);
  });
});

describe("initialsOf", () => {
  it.each([
    ["Rajwant Prajapati", "RP"],
    ["asha", "A"],
    ["Asha  Devi Rao", "AR"],
    ["  ", "?"],
    ["अनु शर्मा", "अश"],
  ])("%j -> %j", (name, initials) => expect(initialsOf(name)).toBe(initials));
});
