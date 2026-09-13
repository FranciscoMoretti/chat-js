import { readFile } from "node:fs/promises";
import pathModule from "node:path";

import { toolItems } from "../../../registry/registry";

const { join } = pathModule;
const compact = (source: string): string =>
  source.replaceAll(/\/\/[^\n]*/gu, "").replaceAll(/\s+/gu, "");
const entries = (body: string): string =>
  body.split(",").filter(Boolean).toSorted().join(",");

// Recognize only known legacy declarations, in any installation order. Never
// evaluate source or discard unknown registrations during migration.
export const legacyTools = async (cwd: string, tools: string, ui: string) => {
  let server = compact(tools);
  let client = compact(ui).replace(
    'importtype{ToolRendererRegistry}from"@/lib/ai/tool-renderer-registry";',
    ""
  );
  const definitions = [];
  for (const {
    meta: { chatjs: item },
  } of toolItems) {
    const serverImport = compact(
      `import { ${item.toolExport} } from "@/tools/chatjs/${item.id}/tool";`
    );
    const clientImport = compact(
      `import { ${item.rendererExport} } from "@/tools/chatjs/${item.id}/renderer";`
    );
    if (server.includes(serverImport) !== client.includes(clientImport)) {
      return null;
    }
    if (!server.includes(serverImport)) {
      continue;
    }
    server = server.replace(serverImport, "");
    client = client.replace(clientImport, "");
    definitions.push(item);
  }
  const serverEntries = server.match(
    /^exportconsttools=\{(?<entries>[^{}]*)\}asconst;$/u
  )?.groups?.entries;
  const clientEntries = client.match(
    /^exportconstui=\{(?<entries>[^{}]*)\}(?:satisfiesToolRendererRegistry)?;$/u
  )?.groups?.entries;
  if (serverEntries === undefined || clientEntries === undefined) {
    return null;
  }
  if (
    entries(serverEntries) !==
    entries(definitions.map((item) => item.toolExport).join(","))
  ) {
    return null;
  }
  if (
    entries(clientEntries) !==
    entries(
      definitions
        .map((item) => `"tool-${item.toolExport}":${item.rendererExport}`)
        .join(",")
    )
  ) {
    return null;
  }
  await Promise.all(
    definitions.flatMap((item) => [
      readFile(join(cwd, "tools/chatjs", item.id, "tool.ts")),
      readFile(join(cwd, "tools/chatjs", item.id, "renderer.tsx")),
    ])
  );
  return definitions;
};
