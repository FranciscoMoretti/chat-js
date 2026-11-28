import { expect, test } from "bun:test";
import { scopeChatCi } from "./chat-ci-scope";

const modified = (...paths: string[]) =>
  paths.map((path) => `M\0${path}\0`).join("");

test("a model picker edit selects model interactions and the app smoke spec", () => {
  expect(
    scopeChatCi(
      modified(
        "packages/registry/src/plugins/model-picker/src/single-model-picker.tsx"
      )
    )
  ).toEqual({
    appSpecs: [
      "chat.e2e.ts",
      "model-toolbar.visual.e2e.ts",
      "eve-disposable-guest.visual.e2e.ts",
    ],
    browser: "selected",
    unit: "full",
  });
});

test("tracks browser entry points by route and combines multiple files", () => {
  expect(
    scopeChatCi(
      modified(
        "apps/chat/app/(chat)/visual-fixtures/model-toolbar/page.tsx",
        "apps/chat/app/(chat)/visual-fixtures/lint-controls/page.tsx",
        "apps/docs/customization/models.mdx"
      )
    )
  ).toEqual({
    appSpecs: [
      "chat.e2e.ts",
      "model-toolbar.visual.e2e.ts",
      "lint-controls.visual.e2e.ts",
    ],
    browser: "selected",
    unit: "changed",
  });
});

test("a shared app layout keeps every app browser spec", () => {
  expect(
    scopeChatCi(
      modified(
        "packages/registry/src/ui/model-selector/model-selector.tsx",
        "apps/chat/app/(chat)/layout.tsx"
      )
    )
  ).toMatchObject({ appSpecs: [], browser: "full" });
});

test.each([
  "bun.lock",
  "apps/chat/vitest.config.ts",
  "apps/chat/lib/db/schema.generated.ts",
  "apps/chat/app/globals.css",
  "packages/registry/src/gateways/catalog.ts",
  "unmapped.txt",
])("runs both full suites when %s changes", (path) => {
  expect(scopeChatCi(modified(path))).toEqual({
    appSpecs: [],
    browser: "full",
    unit: "full",
  });
});

test("skips chat checks for explicitly recognized documentation", () => {
  expect(
    scopeChatCi(modified("README.md", "apps/docs/customization/models.mdx"))
  ).toEqual({ appSpecs: [], browser: "skip", unit: "skip" });
});

test.each([
  "",
  "M\0packages/registry/src/ui/model-selector/model-selector.tsx",
  "D\0packages/registry/src/ui/model-selector/model-selector.tsx\0A\0README.md\0",
])("falls back for an empty, incomplete, or destructive diff %#", (diff) => {
  expect(scopeChatCi(diff)).toEqual({
    appSpecs: [],
    browser: "full",
    unit: "full",
  });
});
