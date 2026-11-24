import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decodeAppPreset,
  encodeAppPreset,
} from "../../../../packages/registry/app-preset";
import { enabledEveDefaultTools } from "../../../../packages/registry/agent-configuration";
import { eveCompositionIssue } from "../../../../packages/registry/eve-catalog";
import {
  installationCatalog,
  resolveInstallationSelection,
} from "../../../../packages/registry/installation-catalog";
import { registryItems } from "../../../../packages/registry/registry-items";
import { storageItems } from "../../../../packages/registry/src/storage/items";
import { canopyBlocks, canopyBuildDefaults } from "./canopy-catalog";
import {
  canopyCreateHref,
  initialCanopySelection,
  toggleCanopyBlock,
} from "./canopy-build";

const catalog = installationCatalog([...registryItems, ...storageItems]);
const checkComposition = (selected: ReadonlySet<string>) => {
  const url = new URL(
    canopyCreateHref(selected, canopyBuildDefaults),
    "http://localhost:3000/"
  );
  assert.equal(url.pathname, "/create");
  const preset = decodeAppPreset(url.searchParams.get("app") ?? "");
  assert.equal(url.searchParams.get("app"), encodeAppPreset(preset));
  const result = resolveInstallationSelection(preset, catalog);
  assert.deepEqual(result.issues, []);
  const { agent, eve, tools, plugins } = result.selection;
  assert.deepEqual(
    new Set([
      ...enabledEveDefaultTools(agent),
      ...(eve ?? []),
      ...tools,
      ...plugins,
    ]),
    selected
  );
};

void test("Canopy opens Create with exactly the chosen app features, agent tools, and integrations", () => {
  const initial = initialCanopySelection(canopyBuildDefaults);
  checkComposition(initial);
  let chosen: ReadonlySet<string> = initial;
  for (const id of [
    "projects",
    "tool/web_search",
    "connection/notion",
    "generate-image",
  ]) {
    chosen = toggleCanopyBlock(chosen, id);
  }
  assert.ok(initial.has("projects"));
  assert.ok(!chosen.has("projects"));
  assert.ok(!chosen.has("tool/web_search"));
  checkComposition(chosen);
});

void test("every unique canopy capability can be enabled together or cleared", () => {
  const all = new Set<string>(canopyBlocks.map(({ id }) => id));
  assert.equal(all.size, canopyBlocks.length);
  assert.equal(
    new Set(canopyBlocks.map(({ name }) => name)).size,
    canopyBlocks.length
  );
  assert.ok(
    [...initialCanopySelection(canopyBuildDefaults)].every((id) => all.has(id))
  );
  assert.ok(
    canopyBlocks.every(({ id }) => eveCompositionIssue(id) === undefined)
  );
  checkComposition(all);
  checkComposition(new Set());
});
