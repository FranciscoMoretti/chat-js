import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: [
      "tests/eve-contracts.e2e.ts",
      "tests/eve-documents.e2e.ts",
      "tests/eve-run-inventory.e2e.ts",
    ],
  },
});
