import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import { registry } from "../registry";

// The manifest — not the folder listing — is the source of truth for what a
// tool renders. A tool without a `rendererExport` (the document tools) is shown
// by the app's own UI and has no renderer to snapshot.
type ChatjsToolMeta = {
  kind?: string;
  tools?: { rendererExport?: string }[];
};

const chatjsMeta = (item: (typeof registry.items)[number]) =>
  (item.meta as { chatjs?: ChatjsToolMeta } | undefined)?.chatjs;

const registryDir = path.join(import.meta.dir, "..");
const toolItems = registry.items.filter(
  (item) => chatjsMeta(item)?.kind === "tool"
);

const parse = (file: string) =>
  ts.createSourceFile(
    file,
    readFileSync(file, "utf-8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

const hasExportModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  );

const exportsName = (source: ts.SourceFile, name: string) =>
  source.statements.some((statement) => {
    if (ts.isVariableStatement(statement) && hasExportModifier(statement)) {
      return statement.declarationList.declarations.some(
        (declaration) =>
          ts.isIdentifier(declaration.name) && declaration.name.text === name
      );
    }
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement)) &&
      hasExportModifier(statement)
    ) {
      return statement.name?.text === name;
    }
    if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      return statement.exportClause.elements.some(
        (element) => element.name.text === name
      );
    }
    return false;
  });

// The local name `./renderer`'s export is imported under (it may be aliased).
const localImportName = (source: ts.SourceFile, name: string) =>
  source.statements
    .flatMap((statement) => {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier) ||
        statement.moduleSpecifier.text !== "./renderer"
      ) {
        return [];
      }
      const bindings = statement.importClause?.namedBindings;
      return bindings && ts.isNamedImports(bindings) ? bindings.elements : [];
    })
    .find((element) => (element.propertyName ?? element.name).text === name)
    ?.name.text;

const rendersJsx = (source: ts.SourceFile, tagName: string) => {
  let found = false;
  const visit = (node: ts.Node) => {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === tagName
    ) {
      found = true;
    }
    if (!found) {
      ts.forEachChild(node, visit);
    }
  };
  visit(source);
  return found;
};

test("every registry tool renderer ships a visual test", () => {
  // Guard against the manifest silently becoming empty (a filter/schema change
  // would otherwise make this test vacuously pass).
  expect(toolItems.length).toBeGreaterThan(0);

  const problems: string[] = [];
  for (const item of toolItems) {
    const { name } = item;
    const rendererExports = (chatjsMeta(item)?.tools ?? []).flatMap((tool) =>
      tool.rendererExport ? [tool.rendererExport] : []
    );
    if (rendererExports.length === 0) {
      continue;
    }

    const rendererPath = path.join(
      registryDir,
      "src",
      "tools",
      name,
      "renderer.tsx"
    );
    const visualPath = path.join(
      registryDir,
      "src",
      "tools",
      name,
      "renderer.visual.tsx"
    );
    if (!existsSync(rendererPath)) {
      problems.push(`${name}: missing src/tools/${name}/renderer.tsx`);
      continue;
    }
    if (!existsSync(visualPath)) {
      problems.push(
        `${name}: missing src/tools/${name}/renderer.visual.tsx (add a snapshot for the new tool)`
      );
      continue;
    }

    const renderer = parse(rendererPath);
    const visual = parse(visualPath);
    for (const rendererExport of rendererExports) {
      if (!exportsName(renderer, rendererExport)) {
        problems.push(`${name}: renderer.tsx must export ${rendererExport}`);
        continue;
      }
      const local = localImportName(visual, rendererExport);
      if (!local || !rendersJsx(visual, local)) {
        problems.push(
          `${name}: renderer.visual.tsx must import ${rendererExport} from ./renderer and render it`
        );
      }
    }
  }

  expect(problems).toEqual([]);
});
