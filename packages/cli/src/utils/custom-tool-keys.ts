/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { existsSync } from "node:fs";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import ts from "typescript";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { ToolDefinition } from "../../../registry/metadata";
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
  const config =
    typeof configPath === "string" && configPath !== ""
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable import/no-named-export */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/prefer-default-export */
