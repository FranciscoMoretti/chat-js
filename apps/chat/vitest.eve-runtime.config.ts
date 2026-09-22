import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/eve-session-mapping.runtime.e2e.ts"],
    testTimeout: 60_000,
  },
});
