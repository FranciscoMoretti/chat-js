// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { stat } from "node:fs/promises";
/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places node:fs/promises (stat) before node:path (path); sort-imports requires the reverse. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

import ts from "typescript";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
/* oxlint-disable sort-imports -- Pinned Oxfmt 0.67.0 restores this declaration order after a native sort-imports-clean reorder: Oxfmt places typescript (ts) before ../../../registry/metadata (ToolDefinition); sort-imports requires the reverse. */
import type { ToolDefinition } from "../../../registry/metadata";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

const EMPTY_COLLECTION_SIZE = 0;
const HELPER_ARGUMENT_INDEX = 0;

type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve customToolsFileExists's awaited sequencing and rejected-Promise behavior. */
const customToolsFileExists = async (filename: string): Promise<boolean> => {
  try {
    await stat(filename);
    return true;
  } catch {
    // Native existsSync treats missing, dangling and inaccessible paths as absent.
    return false;
  }
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (validateCustomToolKeys); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve validateCustomToolKeys's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
export const validateCustomToolKeys = async (
  cwd: string,
  definitions: readonly ReadonlyNative<ToolDefinition>[]
): Promise<void> => {
  const filename = path.join(cwd, "tools/chatjs/custom-tools.ts");
  if (!(await customToolsFileExists(filename))) {
    return;
  }
  const configPath = ts.findConfigFile(cwd, (file) => ts.sys.fileExists(file));
  const config: unknown =
    // oxlint-disable-next-line no-ternary -- Keep config as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    typeof configPath === "string" && configPath !== ""
      ? ts.readConfigFile(configPath, (file) => ts.sys.readFile(file)).config
      : {};
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, cwd);
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing options own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  const program = ts.createProgram([filename], { ...options, noEmit: true });
  const source = program.getSourceFile(filename);
  if (!source) {
    throw new Error("Cannot read custom-tools.ts.");
  }
  // The empty scaffold works before application dependencies are installed.
  const declaration = source.statements
    .filter(ts.isVariableStatement)
    .flatMap(
      (statement: ReadonlyNative<ts.VariableStatement>) =>
        statement.declarationList.declarations
    )
    .find(
      (item: ReadonlyNative<ts.VariableDeclaration>) =>
        ts.isIdentifier(item.name) && item.name.text === "customTools"
    );
  const initializer = declaration && declaration.initializer;
  const usesCoreHelper = source.statements.some(
    (statement: ReadonlyNative<ts.Statement>) =>
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === "@/lib/eve/tool-types" &&
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading namedBindings from statement.importClause; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      statement.importClause?.namedBindings &&
      ts.isNamedImports(statement.importClause.namedBindings) &&
      statement.importClause.namedBindings.elements.some(
        (element: ReadonlyNative<ts.ImportSpecifier>) =>
          element.name.text === "defineToolSet" && !element.propertyName
      )
  );
  const argument =
    // oxlint-disable-next-line no-ternary -- Keep argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    usesCoreHelper &&
    initializer &&
    ts.isCallExpression(initializer) &&
    ts.isIdentifier(initializer.expression) &&
    initializer.expression.text === "defineToolSet"
      ? initializer.arguments[HELPER_ARGUMENT_INDEX]
      : initializer;
  if (
    argument &&
    ts.isObjectLiteralExpression(argument) &&
    argument.properties.length === EMPTY_COLLECTION_SIZE
  ) {
    return;
  }
  const checker = program.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(source);
  const symbol =
    moduleSymbol &&
    checker
      .getExportsOfModule(moduleSymbol)
      .find((item: ReadonlyNative<ts.Symbol>) => item.name === "customTools");
  if (!symbol) {
    throw new Error("custom-tools.ts must export customTools.");
  }
  const type = checker.getTypeOfSymbolAtLocation(symbol, source);
  if (
    type.flags === ts.TypeFlags.Any ||
    type.flags === ts.TypeFlags.Unknown ||
    checker.getIndexInfosOfType(type).length > EMPTY_COLLECTION_SIZE
  ) {
    throw new Error(
      "Cannot determine customTools keys. Install dependencies and export an object with statically known keys."
    );
  }
  const installed = new Set(
    definitions.flatMap((item: ReadonlyNative<ToolDefinition>) =>
      item.tools.map(
        (tool: ReadonlyNative<ToolDefinition["tools"][number]>) =>
          item.slot ?? tool.toolExport
      )
    )
  );
  const collisions = checker
    .getPropertiesOfType(type)
    .map((item: ReadonlyNative<ts.Symbol>) => item.name)
    .filter((key) => installed.has(key));
  if (collisions.length > EMPTY_COLLECTION_SIZE) {
    throw new Error(
      `Custom tools conflict with installed tools: ${collisions.join(", ")}`
    );
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
