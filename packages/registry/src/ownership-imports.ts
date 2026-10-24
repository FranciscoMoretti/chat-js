import path from "node:path";
import ts from "typescript";
import type { ImportEdge } from "./file-ownership";

const localImports = (source: string, file: string): string[] => {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.add(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node)) {
      const argument = node.arguments.at(0);
      if (
        argument &&
        ts.isStringLiteral(argument) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) &&
            node.expression.text === "require"))
      ) {
        imports.add(argument.text);
      }
    }
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      imports.add(node.argument.literal.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return [...imports].filter(
    (specifier) => specifier.startsWith(".") || specifier.startsWith("@/")
  );
};

const localImportTarget = (relativePath: string): string | undefined => {
  const target = relativePath.replaceAll("\\", "/");
  return path.win32.isAbsolute(target) ||
    path.posix.isAbsolute(target) ||
    target === ".." ||
    target.startsWith("../") ||
    target.includes("node_modules/")
    ? undefined
    : target;
};

const resolveImports = (
  file: string,
  source: string,
  root: string,
  options: ts.CompilerOptions
): { edges: ImportEdge[]; unresolved: string[] } => {
  const edges: ImportEdge[] = [];
  const unresolved: string[] = [];
  for (const specifier of localImports(source, file)) {
    const resolved = ts.resolveModuleName(
      specifier,
      path.join(root, file),
      options,
      ts.sys
    ).resolvedModule;
    if (resolved) {
      const target = localImportTarget(
        path.relative(root, resolved.resolvedFileName)
      );
      if (target !== undefined) {
        edges.push({ from: file.replaceAll("\\", "/"), to: target });
      }
    } else if (
      specifier.endsWith(".css") &&
      ts.sys.fileExists(path.resolve(root, path.dirname(file), specifier))
    ) {
      const target = localImportTarget(
        path.relative(root, path.resolve(root, path.dirname(file), specifier))
      );
      if (target !== undefined) {
        edges.push({ from: file.replaceAll("\\", "/"), to: target });
      }
    } else {
      unresolved.push(specifier);
    }
  }
  return { edges, unresolved };
};

export { localImports, localImportTarget, resolveImports };
