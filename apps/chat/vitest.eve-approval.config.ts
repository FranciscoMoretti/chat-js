import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/eve-approval-consumers.e2e.ts"],
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 90_000,
  },
});
