import { defineConfig } from "vitest/config";

import config from "./vitest.eve.config";

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
