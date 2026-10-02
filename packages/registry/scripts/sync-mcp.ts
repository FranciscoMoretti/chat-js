import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { format } from "oxfmt";

import { mcpFiles, mcpItem } from "../src/features/mcp";

// B owns only MCP regeneration. C owns the full demo preset/sync workflow.
const registryRoot = path.resolve(import.meta.dir, "..");
const demoRoot = path.resolve(registryRoot, "../../apps/chat");
const check = process.argv.includes("--check");
const copies = await Promise.all(
  mcpFiles.map(async (file) => ({
    content: await readFile(
      path.join(registryRoot, "src/features/mcp", file),
      "utf-8"
    ),
    file,
  }))
);
const descriptor = "features/mcp/chatjs.json";
const formatted = await format(
  descriptor,
  JSON.stringify(mcpItem.meta?.chatjs),
  {}
);
if (formatted.errors.length) {
  throw new Error("Could not format MCP descriptor");
}
copies.push({ content: formatted.code, file: descriptor });
await Promise.all(
  copies.map(async ({ content, file }) => {
    const target = path.join(demoRoot, file);
    if (check) {
      if ((await readFile(target, "utf-8").catch(() => null)) !== content) {
        throw new Error(
          `MCP demo copy drift: ${file}. Run bun packages/registry/scripts/sync-mcp.ts.`
        );
      }
      return;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content);
  })
);
