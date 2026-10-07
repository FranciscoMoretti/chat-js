import { defineConfig } from "vitest/config";

import config from "./vitest.eve.config";

// oxlint-disable-next-line import/no-default-export -- Vitest loads the configuration through its default export.
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: [
      "tests/eve-submissions.e2e.ts",
      "tests/eve-creation-recovery.e2e.ts",
    ],
  },
});
