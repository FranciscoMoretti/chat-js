import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

import ts from "typescript";

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line eslint/max-statements -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit.
test("public configuration snippets typecheck against the installed application contract", async () => {
  const app = path.resolve(import.meta.dir, "../../../../apps/chat");
  const pages = ["core/configuration", "reference/config"];
  const sources = new Map<string, string>();
  for (const page of pages) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Process each installation or source entry in order and stop at the first relevant result.
    const markdown = await readFile(
      path.join(app, `../docs/${page}.mdx`),
      "utf-8"
    );
    const snippets = [
      ...markdown.matchAll(/```typescript[^\n]*\n(?<source>[\s\S]*?)```/gu),
    ];
    // oxlint-disable-next-line eslint/no-magic-numbers -- These local values specify JSON indentation, source offsets or bounded test fixtures.
    expect(snippets.length).toBeGreaterThan(0);
    for (const [index, match] of snippets.entries()) {
      sources.set(
        path.join(app, `docs-${page.replaceAll("/", "-")}-${index}.ts`),
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading source from match.groups; preserve one receiver evaluation, skipped accesses and the existing "" fallback.
        match.groups?.source ?? ""
      );
    }
  }
  const config = ts.readConfigFile(path.join(app, "tsconfig.json"), (file) =>
    ts.sys.readFile(file)
  );
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, app);
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing parsed.options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  const options = { ...parsed.options, incremental: false };
  const host = ts.createCompilerHost(options);
  const read = host.readFile.bind(host);
  host.readFile = (file): string | undefined => sources.get(file) ?? read(file);
  const program = ts.createProgram([...sources.keys()], options, host);
  const errors = ts
    .getPreEmitDiagnostics(program)
    .filter(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
      (diagnostic) =>
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading fileName from diagnostic.file; preserve one receiver evaluation, skipped accesses and the existing "" fallback.
        Boolean(diagnostic.file) && sources.has(diagnostic.file?.fileName ?? "")
    )
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
    .map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
    );
  expect(errors).toEqual([]);
  // oxlint-disable-next-line eslint/no-magic-numbers -- These local values specify JSON indentation, source offsets or bounded test fixtures.
}, 30_000);
/* oxlint-enable oxc/no-async-await */
