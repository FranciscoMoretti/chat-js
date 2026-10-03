import { existsSync } from "node:fs";
import path from "node:path";

import ts from "typescript";

import type { ToolDefinition } from "../../../registry/metadata";

export const validateCustomToolKeys = (
  cwd: string,
  definitions: ToolDefinition[]
): void => {
  const filename = path.join(cwd, "tools/chatjs/custom-tools.ts");
  if (!existsSync(filename)) {
    return;
  }
  const configPath = ts.findConfigFile(cwd, (file) => ts.sys.fileExists(file));
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- TypeScript owns parsing and diagnostics for tsconfig; preserve its compiler configuration object rather than define a competing parser.
  const config = configPath
    ? ts.readConfigFile(configPath, (file) => ts.sys.readFile(file)).config
    : {};
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, cwd);
  const program = ts.createProgram([filename], { ...options, noEmit: true });
  const source = program.getSourceFile(filename);
  if (!source) {
    throw new Error("Cannot read custom-tools.ts.");
  }
  // The empty scaffold works before application dependencies are installed.
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (item) => ts.isIdentifier(item.name) && item.name.text === "customTools"
    );
  const initializer = declaration?.initializer;
  const usesCoreHelper = source.statements.some(
    (statement) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@/lib/eve/tool-types" &&
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element) =>
          element.name.text === "defineToolSet" && !element.propertyName
      )
  );
  const argument =
    usesCoreHelper &&
    initializer &&
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === "defineToolSet"
      ? initializer.arguments[0]
      : initializer;
  if (
    argument &&
    ts.isObjectLiteralExpression(argument) &&
    argument.properties.length === 0
  ) {
    return;
  }
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const symbol =
    moduleSymbol &&
    checker
      .getExportsOfModule(moduleSymbol)
      .find((item) => item.name === "customTools");
  if (!symbol) {
    throw new Error("custom-tools.ts must export customTools.");
  }
  const type = checker.getTypeOfSymbolAtLocation(symbol, source);
  if (
    type.flags === ts.TypeFlags.Any ||
    type.flags === ts.TypeFlags.Unknown ||
    checker.getIndexInfosOfType(type).length > 0
  ) {
    throw new Error(
      "Cannot determine customTools keys. Install dependencies and export an object with statically known keys."
    );
  }
  const installed = new Set(
    definitions.flatMap((item) =>
      item.tools.map((tool) => item.slot ?? tool.toolExport)
    )
  );
  const collisions = checker
    .getPropertiesOfType(type)
    .map((item) => item.name)
    .filter((key) => installed.has(key));
  if (collisions.length > 0) {
    throw new Error(
      `Custom tools conflict with installed tools: ${collisions.join(", ")}`
    );
  }
};
