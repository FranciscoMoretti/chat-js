import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { generateDemo } from "../scripts/demo-generator";

const GENERATION_TIMEOUT_MS = 60_000;

test(
  "demo generation preserves canonical import order and directive attachment",
  async () => {
    const { files: generated } = await generateDemo();
    await Promise.all(
      [
        {
          source: "./plugins/mcp/src/runtime/mcp-tools.ts",
          target: "chatjs/plugins/mcp/runtime/mcp-tools.ts",
        },
        {
          source: "./plugins/vercel-speed-insights/src/component.tsx",
          target: "chatjs/plugins/vercel-speed-insights/component.tsx",
        },
      ].map(
        async ({
          source,
          target,
        }: Readonly<{ source: string; target: string }>) => {
          const canonical = await readFile(
            new URL(source, import.meta.url),
            "utf-8"
          );
          expect(generated.get(target)).toBe(canonical);
        }
      )
    );
  },
  GENERATION_TIMEOUT_MS
);
