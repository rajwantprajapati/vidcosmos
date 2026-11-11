// Shared test setup: DOM matchers, and unmounting React trees after each DOM test.
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

if (typeof window !== "undefined" && typeof globalThis.ResizeObserver === "undefined") {
  // jsdom has no ResizeObserver; Radix measures elements with it. Sizes don't matter in these tests.
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
