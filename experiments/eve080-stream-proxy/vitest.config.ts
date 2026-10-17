import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "../../apps/chat") },
  },
  test: {
    include: ["experiments/eve080-stream-proxy/proxy.scenario.ts"],
    testTimeout: 75_000,
  },
});
