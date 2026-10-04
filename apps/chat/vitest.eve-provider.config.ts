import { defineConfig } from "vitest/config";

import nativeConfig from "./vitest.eve.config";

// The required provider gate has no worker, browser, model, or cloud credentials.
// Broader app/database scenarios remain in vitest.eve.config.ts.
/* oxlint-disable import/no-default-export -- Vitest loads this configuration through its default-export contract. */
export default defineConfig({
  ...nativeConfig,
  test: {
    ...nativeConfig.test,
    include: [
      "tests/eve-lifecycle-provider.e2e.ts",
      "tests/eve-postgres-stream-resume.e2e.ts",
      "tests/eve-run-inventory.e2e.ts",
      "tests/eve-resource-fence.e2e.ts",
      "tests/eve-queue-inventory.e2e.ts",
      "tests/eve-queue-cancellation.e2e.ts",
      "tests/eve-queue-fence.e2e.ts",
      "tests/eve-payload-purge.e2e.ts",
    ],
  },
});
