import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/eve-session-mapping.runtime.e2e.ts"],
    testTimeout: 60_000,
  },
});
