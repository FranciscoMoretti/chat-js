/* oxlint-disable import/no-nodejs-modules, import/no-default-export -- Vitest loads this Node configuration through its required default export. */
import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../../../apps/chat") },
  },
  test: {
    include: ["tests/eve-retirement-lane-a/postgres/*.test.ts"],
    testTimeout: 15_000,
  },
});
