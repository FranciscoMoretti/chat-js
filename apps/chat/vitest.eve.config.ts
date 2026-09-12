import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "tests/eve-contracts.e2e.ts",
      "tests/eve-response-groups.e2e.ts",
      "tests/eve-usage-cursor.e2e.ts",
      "tests/eve-code-sandboxes.e2e.ts",
      "tests/eve-delete-family.e2e.ts",
      "tests/eve-postgres-stream-resume.e2e.ts",
      "tests/eve-votes.e2e.ts",
      "tests/eve-projects.e2e.ts",
      "tests/eve-documents.e2e.ts",
      "tests/eve-copy-documents.e2e.ts",
      "tests/eve-copy-journal.e2e.ts",
      "tests/eve-files.e2e.ts",
      "tests/eve-file-storage.e2e.ts",
      "tests/eve-local-snapshots.e2e.ts",
      "tests/eve-run-inventory.e2e.ts",
      "tests/eve-resource-fence.e2e.ts",
      "tests/eve-queue-inventory.e2e.ts",
      "tests/eve-queue-cancellation.e2e.ts",
      "tests/eve-queue-fence.e2e.ts",
      "tests/eve-payload-purge.e2e.ts",
    ],
  },
});
