const fullSuite = { appSpecs: [], browser: "full", unit: "full" } as const;

// Browser specs navigate by URL, so import-graph selection cannot link them to routes.
const modelPickerSpecs = [
  "model-toolbar.visual.e2e.ts",
  "eve-disposable-guest.visual.e2e.ts",
];
const browserSpecsBySource = new Map([
  [
    "packages/registry/src/plugins/model-picker/src/single-model-picker.tsx",
    modelPickerSpecs,
  ],
  [
    "packages/registry/src/ui/model-selector/model-selector.tsx",
    modelPickerSpecs,
  ],
  [
    "packages/registry/src/ui/model-selector/model-selector-view.tsx",
    modelPickerSpecs,
  ],
  ["packages/registry/src/ui/model-logo.tsx", modelPickerSpecs],
  ["apps/chat/components/model-toolbar-visual-fixture.tsx", modelPickerSpecs],
  [
    "apps/chat/app/(chat)/visual-fixtures/disposable-guest/page.tsx",
    ["eve-disposable-guest.visual.e2e.ts"],
  ],
  [
    "apps/chat/app/(chat)/visual-fixtures/layout-primitives/page.tsx",
    ["layout-primitives.visual.e2e.ts"],
  ],
  [
    "apps/chat/app/(chat)/visual-fixtures/lint-controls/page.tsx",
    ["lint-controls.visual.e2e.ts"],
  ],
  [
    "apps/chat/app/(chat)/visual-fixtures/model-toolbar/page.tsx",
    ["model-toolbar.visual.e2e.ts"],
  ],
  [
    "apps/chat/app/(chat)/visual-fixtures/ui-primitives/page.tsx",
    ["ui-primitives.visual.e2e.ts"],
  ],
]);

const docsPath = /^(?:README\.md|apps\/docs\/[^\n]+\.mdx)$/u;
const appUnitSource =
  /^apps\/chat\/(?:app|components|hooks|integrations|lib|providers|trpc)\/[^\n]+\.tsx?$/u;
const fullUnitSource =
  /(?:^|\/)(?:__generated__|migrations|fixtures)\/|\.(?:config|d|generated)\.tsx?$/u;

export const scopeChatCi = (nameStatus: string) => {
  const entries = nameStatus.split("\0");
  if (
    entries.pop() !== "" ||
    entries.length === 0 ||
    entries.length % 2 !== 0
  ) {
    return fullSuite;
  }

  const paths: string[] = [];
  for (let index = 0; index < entries.length; index += 2) {
    const [status, path] = entries.slice(index, index + 2);
    if (
      (status !== "A" && status !== "M") ||
      path === undefined ||
      path === ""
    ) {
      return fullSuite;
    }
    if (!docsPath.test(path)) {
      paths.push(path);
    }
  }

  if (paths.length === 0) {
    return { appSpecs: [], browser: "skip", unit: "skip" } as const;
  }

  const appSpecs = new Set(["chat.e2e.ts"]);
  const browserIsMapped = paths.every((path) => {
    const specs = browserSpecsBySource.get(path);
    if (!specs) {
      return false;
    }
    for (const spec of specs) {
      appSpecs.add(spec);
    }
    return true;
  });

  return {
    appSpecs: browserIsMapped ? [...appSpecs] : [],
    browser: browserIsMapped ? "selected" : "full",
    unit: paths.every(
      (path) => appUnitSource.test(path) && !fullUnitSource.test(path)
    )
      ? "changed"
      : "full",
  } as const;
};

if (import.meta.main) {
  const scope = scopeChatCi(await Bun.stdin.text());
  console.log(
    `browser=${scope.browser}\napp_specs=${scope.appSpecs.join(" ")}\nunit=${scope.unit}`
  );
}
