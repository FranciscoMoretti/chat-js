import { defineConfig } from "playwright/test";
import { fileURLToPath } from "node:url";

process.env.UIVERIFY_ARCHIVE_DIR = fileURLToPath(
  new URL("../uiverify-archive", import.meta.url)
);

export default defineConfig({
  testDir: ".",
  testMatch: "create-activity.spec.mts",
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL:
      process.env.CREATE_BASE_URL ?? `http://localhost:${process.env.PORT}`,
    storageState: process.env.CREATE_STORAGE_STATE,
    contextOptions: { reducedMotion: "reduce" },
    permissions: ["clipboard-read", "clipboard-write"],
  },
});
