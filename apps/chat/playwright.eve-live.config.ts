import { defineConfig } from "@playwright/test";
import config from "./playwright.eve.config";

export default defineConfig({
  ...config,
  testMatch: [
    "eve-live.e2e.ts",
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
