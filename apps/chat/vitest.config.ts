import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ["**/node_modules/**", "**/*.e2e.ts"],
    // Execute the maintained adapter while mocking its network SDK in contract tests.
    server: { deps: { inline: ["files-sdk"] } },
  },
});
