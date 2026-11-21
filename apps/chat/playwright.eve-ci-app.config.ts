import { defineConfig } from "@playwright/test";
import app from "./playwright.config";
import { standaloneVisualCases } from "./playwright.eve-ci-fixtures.config";

export default defineConfig({
  ...app,
  grepInvert: standaloneVisualCases,
  reporter: "list",
});
