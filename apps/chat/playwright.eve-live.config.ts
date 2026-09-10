import { defineConfig } from "@playwright/test";
import config from "./playwright.eve.config";

export default defineConfig({
  ...config,
  testMatch: [
    "eve-mcp.e2e.ts",
    "eve-image.e2e.ts",
    "eve-research.e2e.ts",
    "eve-create-recovery.e2e.ts",
    "eve-rejected-send.e2e.ts",
    "eve-document-run.e2e.ts",
    "eve-document-tools.e2e.ts",
    "eve-live.e2e.ts",
    "eve-code-execution.e2e.ts",
    "eve-search.e2e.ts",
    "eve-tool-renderers.e2e.ts",
    "eve-forks.e2e.ts",
    "eve-editing.e2e.ts",
    "eve-metadata.e2e.ts",
    "eve-history.e2e.ts",
    "eve-attachments.e2e.ts",
    "eve-sharing.e2e.ts",
    "eve-pdf.e2e.ts",
  ],
  timeout: 120_000,
});
