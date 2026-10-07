import tsconfigPaths from "vite-tsconfig-paths";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { defineConfig } from "vitest/config";
/* oxlint-enable sort-imports */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ["**/node_modules/**", "**/*.e2e.ts"],
    // Execute the maintained adapter while mocking its network SDK in contract tests.
    server: { deps: { inline: ["files-sdk"] } },
  },
});
/* oxlint-enable import/no-default-export */
