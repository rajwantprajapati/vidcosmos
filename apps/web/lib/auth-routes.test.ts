import { describe, expect, it } from "vitest";
import { isProtectedPath, onboardingPath, safeReturnTo, signInPath } from "./auth-routes";

describe("isProtectedPath", () => {
  it.each([
    "/library",
    "/library/x",
    "/onboarding",
    "/projects/abc/script",
    "/posts",
    "/settings",
    "/admin",
  ])("%s needs a session", (path) => expect(isProtectedPath(path)).toBe(true));

  it.each([
    "/",
    "/sign-in",
    "/sign-up",
    "/verify",
    "/reset-password",
    "/libraryx",
    "/api/auth/get-session",
  ])("%s is open", (path) => expect(isProtectedPath(path)).toBe(false));
});

describe("safeReturnTo", () => {
  it.each([
    ["/settings/profile?tab=1", "/settings/profile?tab=1"],
    [undefined, "/library"],
    ["", "/library"],
    ["https://evil.example/", "/library"],
    ["//evil.example/", "/library"],
    ["/\\evil.example", "/library"],
    ["library", "/library"],
  ])("%j -> %j", (value, expected) => expect(safeReturnTo(value)).toBe(expected));
});

describe("signInPath", () => {
  it("leaves out ?next for the app home", () => {
    expect(signInPath("/library")).toBe("/sign-in");
    expect(signInPath()).toBe("/sign-in");
  });

  it("encodes the page to come back to", () => {
    expect(signInPath("/settings/profile?x=1")).toBe("/sign-in?next=%2Fsettings%2Fprofile%3Fx%3D1");
  });
});

describe("onboardingPath", () => {
  it("comes back to the page that was asked for", () => {
    expect(onboardingPath("/posts")).toBe("/onboarding?next=%2Fposts");
    expect(onboardingPath("/library")).toBe("/onboarding");
    expect(onboardingPath(null)).toBe("/onboarding");
  });

  it("never sends anyone off the site", () => {
    expect(onboardingPath("//evil.example")).toBe("/onboarding");
    expect(onboardingPath("https://evil.example")).toBe("/onboarding");
  });
});
