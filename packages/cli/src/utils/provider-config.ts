// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

import ts from "typescript";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { GatewaySelection } from "#cli/registry/gateways";
/* oxlint-enable sort-imports */

const INITIAL_REFERENCE_COUNT = 0;
const REFERENCE_INCREMENT = 1;
const SINGLE_BINDING_REFERENCE_COUNT = 2;
const CONFIG_ARGUMENT_INDEX = 0;
const SOURCE_START = 0;

// Preserve the compiler's callable guards/node methods while reading its fields.
type ReadonlyNative<Value> = Value extends (
  ...args: readonly never[]
) => unknown
  ? Value
  : Value extends object
    ? { readonly [Key in keyof Value]: ReadonlyNative<Value[Key]> }
    : Value;

const unwrap = (expression: ReadonlyNative<ts.Expression>): ts.Expression => {
  let value = expression;
  while (
    ts.isSatisfiesExpression(value) ||
    ts.isAsExpression(value) ||
    ts.isTypeAssertionExpression(value) ||
    ts.isParenthesizedExpression(value)
  ) {
    value = value.expression;
  }
  return value;
};

// Read generated data without importing or executing application code.
// oxlint-disable-next-line eslint/max-statements, typescript/prefer-readonly-parameter-types -- Keep validation, ownership checks and updates in their ordered operation so failure boundaries remain explicit. TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
const literalValue = (input: ts.Expression): unknown => {
  const value = unwrap(input);
  if (ts.isStringLiteralLike(value)) {
    return value.text;
  }
  if (ts.isNumericLiteral(value)) {
    return Number(value.text);
  }
  if (value.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }
  if (value.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }
  if (ts.isArrayLiteralExpression(value)) {
    return value.elements.map(literalValue);
  }
  if (ts.isObjectLiteralExpression(value)) {
    return Object.fromEntries(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
      value.properties.map((property) => {
        if (
          !ts.isPropertyAssignment(property) ||
          !(
            ts.isIdentifier(property.name) ||
            ts.isStringLiteralLike(property.name)
          )
        ) {
          throw new Error("Provider data must use literal properties.");
        }
        return [property.name.text, literalValue(property.initializer)];
      })
    );
  }
  throw new Error(
    "Provider data must use literal values. Integrate this provider manually."
  );
};

const readProviderLiteral = async (
  cwd: string,
  file: string,
  name: string
): Promise<unknown> => {
  const source = await readFile(path.join(cwd, file), "utf-8");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const declaration = parsed.statements
    .filter(ts.isVariableStatement)
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
    .flatMap((statement) => statement.declarationList.declarations)
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript/compiler and registry APIs expose mutable library types; this boundary only reads them.
    .find((item) => item.name.getText(parsed) === name);
  if (!declaration?.initializer) {
    throw new Error(
      `Missing ${name} in ${file}. Reinstall the provider before adding dependent tools.`
    );
  }
  return literalValue(declaration.initializer);
};
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
// Object properties apply in order. A later spread or computed key can override
// a named property; only a subsequent explicit assignment makes it safe again.
const activeProperty = (
  object: ReadonlyNative<ts.ObjectLiteralExpression>,
  name: string
): ts.PropertyAssignment | undefined => {
  let selected: ts.PropertyAssignment | undefined = undefined;
  for (const property of object.properties) {
    if (
      ts.isSpreadAssignment(property) ||
      (property.name !== undefined && ts.isComputedPropertyName(property.name))
    ) {
      selected = undefined;
    } else if (
      property.name !== undefined &&
      (ts.isIdentifier(property.name) ||
        ts.isStringLiteralLike(property.name)) &&
      property.name.text === name
    ) {
      selected = undefined;
      if (ts.isPropertyAssignment(property)) {
        selected = property;
      }
    }
  }
  return selected;
};
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable eslint/max-statements -- File absence, provider-specific discriminator selection and literal AST validation determine one installed-provider lookup result. */
const readProviderId = async (
  cwd: string,
  kind: "gateway" | "storage"
): Promise<string | undefined> => {
  let file = "lib/storage-options.ts";
  let name = "storageId";
  if (kind === "gateway") {
    file = "lib/ai/gateway-model-defaults.ts";
    name = "gatewayType";
  }
  const source = await readFile(path.join(cwd, file), "utf-8").catch(
    (error: unknown): string => {
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return "";
      }
      throw error;
    }
  );
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const declaration = parsed.statements
    .filter(ts.isVariableStatement)
    .flatMap(
      (statement: ReadonlyNative<ts.VariableStatement>) =>
        statement.declarationList.declarations
    )
    .find(
      (item: ReadonlyNative<ts.VariableDeclaration>): boolean =>
        item.name.getText(parsed) === name
    );
  if (!source.trim()) {
    return;
  }
  const value = declaration?.initializer && unwrap(declaration.initializer);
  if (!value || !ts.isStringLiteralLike(value)) {
    throw new Error(
      `Cannot determine the installed ${kind} in ${file}. Use a literal ${name} before automatic replacement, or integrate the provider manually.`
    );
  }
  // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
  return value.text;
};
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements, eslint/max-lines-per-function -- The gateway edit resolves one const/export chain against a shared declaration list and cycle/reference tracking before replacing only the verified discriminator span. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/**
 * Change the discriminator; preserve editable model/parameter selections.
 * @param {string} cwd Project directory containing chat.config.ts.
 * @param {ReadonlyNative<GatewaySelection>} selection Gateway whose ID replaces the active discriminator.
 * @returns {Promise<string>} Updated configuration source without writing the file.
 */
const gatewayConfigEdit = async (
  cwd: string,
  selection: ReadonlyNative<GatewaySelection>
): Promise<string> => {
  const file = path.join(cwd, "chat.config.ts");
  const source = await readFile(file, "utf-8");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const exported = parsed.statements.find(ts.isExportAssignment);
  const declarations = parsed.statements
    .filter(ts.isVariableStatement)
    // Mutable bindings may no longer refer to their initializer at runtime.
    .filter(
      (statement: ReadonlyNative<ts.VariableStatement>): number =>
        // oxlint-disable-next-line eslint/no-bitwise -- TypeScript represents declaration modifiers as a bitmask.
        statement.declarationList.flags & ts.NodeFlags.Const
    )
    .flatMap(
      (statement: ReadonlyNative<ts.VariableStatement>) =>
        statement.declarationList.declarations
    );
  const seen = new Set<string>();
  const resolve = (
    input: ReadonlyNative<ts.Expression>
  ): ts.Expression | undefined => {
    const value = unwrap(input);
    if (!ts.isIdentifier(value)) {
      return value;
    }
    if (seen.has(value.text)) {
      return undefined;
    }
    seen.add(value.text);
    // A binding used elsewhere may have its object mutated before configuration.
    // Follow only a declaration and its single use in the active config chain.
    let references = INITIAL_REFERENCE_COUNT;
    const visit = (node: ReadonlyNative<ts.Node>): void => {
      if (ts.isIdentifier(node) && node.text === value.text) {
        references += REFERENCE_INCREMENT;
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (references !== SINGLE_BINDING_REFERENCE_COUNT) {
      return undefined;
    }
    const initializer = declarations.find(
      (declaration: ReadonlyNative<ts.VariableDeclaration>): boolean =>
        declaration.name.getText(parsed) === value.text
    )?.initializer;
    if (initializer === undefined) {
      return undefined;
    }
    return resolve(initializer);
  };
  let expression: ts.Expression | undefined = undefined;
  if (exported !== undefined) {
    expression = resolve(exported.expression);
  }
  let configArgument: ts.Expression | undefined = undefined;
  if (
    expression !== undefined &&
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "defineConfig"
  ) {
    configArgument = expression.arguments[CONFIG_ARGUMENT_INDEX];
  }
  let resolvedConfigArgument: ts.Expression | undefined = undefined;
  if (configArgument !== undefined) {
    resolvedConfigArgument = resolve(configArgument);
  }
  let config = expression;
  if (expression !== undefined && ts.isCallExpression(expression)) {
    config = resolvedConfigArgument;
  }
  let aiProperty: ts.PropertyAssignment | undefined = undefined;
  if (config !== undefined && ts.isObjectLiteralExpression(config)) {
    aiProperty = activeProperty(config, "ai");
  }
  let ai: ts.Expression | undefined = undefined;
  if (aiProperty !== undefined) {
    ai = unwrap(aiProperty.initializer);
  }
  let gateway: ts.PropertyAssignment | undefined = undefined;
  if (ai !== undefined && ts.isObjectLiteralExpression(ai)) {
    gateway = activeProperty(ai, "gateway");
  }
  if (gateway === undefined) {
    throw new Error(
      "chat.config.ts must have a literal ai.gateway without later spreads or computed keys that could override it to replace the gateway automatically. Integrate the new gateway configuration manually."
    );
  }
  return (
    source.slice(SOURCE_START, gateway.initializer.getStart(parsed)) +
    JSON.stringify(selection.definition.id) +
    source.slice(gateway.initializer.end)
  );
};
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-statements, eslint/max-lines-per-function */
export { gatewayConfigEdit, readProviderId, readProviderLiteral };
