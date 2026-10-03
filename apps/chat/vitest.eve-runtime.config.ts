import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ["tests/eve-session-mapping.runtime.e2e.ts"],
    testTimeout: 60_000,
  },
});
/* oxlint-enable import/no-default-export */
