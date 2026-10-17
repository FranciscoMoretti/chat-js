import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../../apps/chat") },
  },
  test: {
    include: ["experiments/eve080-approval-consumers/consumers.scenario.ts"],
    testTimeout: 45_000,
    hookTimeout: 90_000,
  },
});
