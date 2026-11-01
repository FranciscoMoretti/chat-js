import { expect, test } from "bun:test";
import path from "node:path";
import { readFile } from "node:fs/promises";

import ts from "typescript";

const minimumDocumentationSnippetCount = 0;
const documentationTypecheckTimeoutMs = 30_000;

test(
  "public configuration snippets typecheck against the installed application contract",
  async () => {
    const app = path.resolve(import.meta.dir, "../../../../apps/chat");
    const pages = ["core/configuration", "reference/config"];
    const sources = new Map<string, string>();
    const markdownPages = await Promise.all(
      pages.map(
        async (page) =>
          await readFile(path.join(app, `../docs/${page}.mdx`), "utf-8")
      )
    );
    for (const [pageIndex, page] of pages.entries()) {
      const markdown = markdownPages[pageIndex] ?? "";
      const snippets = [
        ...markdown.matchAll(/```typescript[^\n]*\n(?<source>[\s\S]*?)```/gu),
      ];
      expect(snippets.length).toBeGreaterThan(minimumDocumentationSnippetCount);
      for (const [index, match] of snippets.entries()) {
        const { source = "" } = match.groups ?? {};
        sources.set(
          path.join(app, `docs-${page.replaceAll("/", "-")}-${index}.ts`),
          source
        );
      }
    }
    const config = ts.readConfigFile(path.join(app, "tsconfig.json"), (file) =>
      ts.sys.readFile(file)
    );
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, app);
    const options = { ...parsed.options, incremental: false };
    const host = ts.createCompilerHost(options);
    const read = host.readFile.bind(host);
    host.readFile = (file): string | undefined =>
      sources.get(file) ?? read(file);
    const program = ts.createProgram([...sources.keys()], options, host);
    const errors = ts
      .getPreEmitDiagnostics(program)
      .filter(
        (diagnostic: { readonly file?: { readonly fileName: string } }) =>
          diagnostic.file !== globalThis.undefined &&
          sources.has(diagnostic.file.fileName)
      )
      .map((diagnostic) =>
        ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
      );
    expect(errors).toEqual([]);
  },
  documentationTypecheckTimeoutMs
);
