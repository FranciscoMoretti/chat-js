import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { registry } from "../registry";

// The manifest — not the folder listing — is the source of truth for what a
// "tool" is. Shared helpers like `toolkit-renderer` have no `meta.chatjs.kind`,
// so they are excluded and never flagged.
type ChatjsToolMeta = { kind?: string; rendererExport?: string };

const chatjsMeta = (item: (typeof registry.items)[number]) =>
  (item.meta as { chatjs?: ChatjsToolMeta } | undefined)?.chatjs;

const registryDir = path.join(import.meta.dir, "..");
const toolItems = registry.items.filter(
  (item) => chatjsMeta(item)?.kind === "tool"
);

test("every registry tool ships a renderer and a visual test", () => {
  // Guard against the manifest silently becoming empty (a filter/schema change
  // would otherwise make this test vacuously pass).
  expect(toolItems.length).toBeGreaterThan(0);

  const problems: string[] = [];
  for (const item of toolItems) {
    const { name } = item;
    const rendererExport = chatjsMeta(item)?.rendererExport;
    if (!rendererExport) {
      problems.push(`${name}: manifest is missing meta.chatjs.rendererExport`);
      continue;
    }

    const rendererPath = path.join(
      registryDir,
      "src",
      "tools",
      name,
      "renderer.tsx"
    );
    if (!existsSync(rendererPath)) {
      problems.push(`${name}: missing src/tools/${name}/renderer.tsx`);
    } else if (!readFileSync(rendererPath, "utf-8").includes(rendererExport)) {
      problems.push(`${name}: renderer.tsx must export ${rendererExport}`);
    }

    const visualPath = path.join(
      registryDir,
      "src",
      "tools",
      name,
      "renderer.visual.tsx"
    );
    if (!existsSync(visualPath)) {
      problems.push(
        `${name}: missing src/tools/${name}/renderer.visual.tsx (add a snapshot for the new tool)`
      );
    } else if (!readFileSync(visualPath, "utf-8").includes(rendererExport)) {
      problems.push(
        `${name}: src/tools/${name}/renderer.visual.tsx must render ${rendererExport}`
      );
    }
  }

  expect(problems).toEqual([]);
});
