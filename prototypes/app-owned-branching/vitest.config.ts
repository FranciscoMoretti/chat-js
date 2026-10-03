import { defineConfig } from "vitest/config";

/* oxlint-disable import/no-default-export -- vitest.config.ts: This framework/tool loader consumes the default entrypoint; changing export shape would break discovery. */
export default defineConfig({
  test: {
    hookTimeout: 30_000,
    include: ["prototypes/app-owned-branching/*.test.ts"],
    testTimeout: 15_000,
  },
});
/* oxlint-enable import/no-default-export */
