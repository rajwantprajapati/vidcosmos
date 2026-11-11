import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // One in-memory MongoDB replica set for the whole run; each test file uses its own database.
    globalSetup: ["./src/testing/global-setup.ts"],
    // The first run downloads the MongoDB binary (cached afterwards).
    hookTimeout: 180_000,
    testTimeout: 30_000,
  },
});
