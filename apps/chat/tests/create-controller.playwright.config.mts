import { defineConfig } from "playwright/test";
import { fileURLToPath } from "node:url";

process.env.UIVERIFY_ARCHIVE_DIR ??= fileURLToPath(
  new URL("../uiverify-archive", import.meta.url)
);

export default defineConfig({
  testDir: ".",
  testMatch: "create-controller.spec.mts",
  workers: 1,
  timeout: 90_000,
  use: {
    baseURL:
      process.env.CREATE_CONTROLLER_URL ??
      `http://localhost:${process.env.PORT}`,
    contextOptions: { reducedMotion: "reduce" },
  },
});
