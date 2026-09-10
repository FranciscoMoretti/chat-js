import { defineConfig } from "@playwright/test";
import config from "./playwright.eve.config";

export default defineConfig({
  ...config,
  testMatch: [
    "eve-live.e2e.ts",
    "eve-metadata.e2e.ts",
    "eve-attachments.e2e.ts",
  ],
  timeout: 120_000,
});
