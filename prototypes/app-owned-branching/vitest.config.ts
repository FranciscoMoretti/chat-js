import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    include: ["prototypes/app-owned-branching/*.test.ts"],
    testTimeout: 15_000,
  },
});
