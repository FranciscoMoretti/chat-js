import {
  combinationCases,
  pluginPrerequisites,
} from "../scripts/installation-cases";
import { dependencyName } from "@chat-js/registry-validation/ownership";
import { beforeAll, expect, test } from "bun:test";
import { registry } from "../registry";
import { pluginDefinitionSchema } from "../metadata";
import { itemClaims } from "../src/installation-ownership";
import { targetPath } from "../src/file-ownership";
import {
  validationDependencyFixtures,
  prepareValidationCore,
  renderValidationProject,
} from "../scripts/validation-project";
import { typecheckProject } from "@chat-js/registry-validation";
import { GATEWAYS } from "../../cli/src/types";

const plugins = registry.items.flatMap((item) => {
  const parsed = pluginDefinitionSchema.safeParse(item.meta?.chatjs);
  return parsed.success ? [parsed.data] : [];
});
const prepared = { core: new Map<string, Uint8Array>() };
beforeAll(async () => {
  prepared.core = await prepareValidationCore();
});

for (const gateway of GATEWAYS) {
  test(`${gateway}: the manifest-derived empty installation typechecks`, async () => {
    const { files } = await renderValidationProject(prepared.core, {
      gateway,
      storage: { source: "memory", options: {} },
      plugins: [],
      tools: [],
    });
    expect(
      [...files.keys()].filter((file) => file.startsWith("plugins/"))
    ).toEqual([]);
    expect(
      typecheckProject(files, validationDependencyFixtures).diagnostics
    ).toEqual([]);
  }, 60_000);
}

for (const plugin of plugins) {
  test(`${plugin.id}: catalog-derived plugin selection typechecks without omitted plugins`, async () => {
    const selected = pluginPrerequisites([plugin.id]);
    const output = await renderValidationProject(prepared.core, {
      gateway: "openai",
      tools: [],
      plugins: selected,
      sandbox: selected.some(
        (id) =>
          plugins.find((candidate) => candidate.id === id)
            ?.requiresPersistentSandbox
      )
        ? "vercel"
        : undefined,
      storage: {
        source: selected.some(
          (id) =>
            plugins.find((candidate) => candidate.id === id)?.requiresStorage
        )
          ? "vercel-blob"
          : "memory",
        options: {},
      },
    });
    const selectedNames = new Set(output.items.map((item) => item.name));
    const selectedTargets = new Set(
      output.items.flatMap(itemClaims).map((claim) => targetPath(claim.target))
    );
    for (const item of registry.items.filter(
      (candidate) =>
        !selectedNames.has(candidate.name) &&
        pluginDefinitionSchema.safeParse(candidate.meta?.chatjs).success
    )) {
      for (const claim of itemClaims(item)) {
        const target = targetPath(claim.target);
        if (!selectedTargets.has(target)) {
          expect(output.files.has(target)).toBe(false);
        }
      }
    }
    expect(
      typecheckProject(output.files, validationDependencyFixtures).diagnostics
    ).toEqual([]);
    if (plugin.id === "search") {
      output.files.delete("plugins/search/server-plugin.ts");
      expect(
        typecheckProject(
          output.files,
          validationDependencyFixtures
        ).diagnostics.some((diagnostic) => diagnostic.code === 2307)
      ).toBe(true);
    }
  }, 60_000);
}

test("tool composition retains registry dependencies and cannot borrow undeclared packages", async () => {
  const output = await renderValidationProject(prepared.core, {
    gateway: "openai",
    storage: { source: "memory", options: {} },
    plugins: ["feedback"],
    tools: ["word-count"],
  });
  expect(
    output.items
      .find((item) => item.name === "word-count")
      ?.dependencies?.map(dependencyName)
  ).toContain("zod");
  expect(
    typecheckProject(output.files, validationDependencyFixtures).diagnostics
  ).toEqual([]);
  output.files.set(
    "undeclared.ts",
    new TextEncoder().encode('export { tavily } from "@tavily/core";')
  );
  expect(
    typecheckProject(
      output.files,
      validationDependencyFixtures
    ).diagnostics.some(
      (diagnostic) =>
        diagnostic.code === 2307 && diagnostic.file === "undeclared.ts"
    )
  ).toBe(true);
}, 60_000);

for (const scenario of combinationCases) {
  test(`${scenario.name}: metadata-derived composition typechecks`, async () => {
    const output = await renderValidationProject(
      prepared.core,
      scenario.selection
    );
    expect(
      typecheckProject(output.files, validationDependencyFixtures).diagnostics
    ).toEqual([]);
  }, 60_000);
}
