import type { GatewaySelection } from "#cli/registry/gateways";

import path from "node:path";
import { readFile } from "node:fs/promises";

import ts from "typescript";

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
const literalValue = (input: ReadonlyNative<ts.Expression>): unknown => {
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
      value.properties.map(
        (property: ReadonlyNative<ts.ObjectLiteralElementLike>) => {
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
        }
      )
    );
  }
  throw new Error(
    "Provider data must use literal values. Integrate this provider manually."
  );
};

const parseProviderLiteral = (
  source: string,
  file: string,
  name: string
): unknown => {
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
      (item: { readonly name: Readonly<Pick<ts.Node, "getText">> }) =>
        item.name.getText(parsed) === name
    );
  if (!declaration || !declaration.initializer) {
    throw new Error(
      `Missing ${name} in ${file}. Reinstall the provider before adding dependent tools.`
    );
  }
  return literalValue(declaration.initializer);
};
const readProviderLiteral = async (
  cwd: string,
  file: string,
  name: string
): Promise<unknown> =>
  parseProviderLiteral(
    await readFile(path.join(cwd, file), "utf-8"),
    file,
    name
  );

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

const readProviderId = async (
  cwd: string,
  kind: "gateway" | "storage" | "sandbox"
): Promise<string | undefined> => {
  let file = "lib/storage-options.ts";
  let name = "storageId";
  if (kind === "gateway") {
    file = "lib/ai/gateway-model-defaults.ts";
    name = "gatewayType";
  }
  if (kind === "sandbox") {
    file = "lib/sandbox/options.ts";
    name = "sandboxId";
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
    return undefined;
  }
  const value =
    declaration && declaration.initializer && unwrap(declaration.initializer);
  if (!value || !ts.isStringLiteralLike(value)) {
    throw new Error(
      `Cannot determine the installed ${kind} in ${file}. Use a literal ${name} before automatic replacement, or integrate the provider manually.`
    );
  }
  return value.text;
};

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
    // Follow const and await using bindings; mutable bindings may have changed.
    .filter((statement: ReadonlyNative<ts.VariableStatement>): boolean => {
      const keyword = statement.declarationList.getFirstToken(parsed)?.kind;
      return (
        keyword === ts.SyntaxKind.ConstKeyword ||
        keyword === ts.SyntaxKind.AwaitKeyword
      );
    })
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
    const declaration = declarations.find(
      (candidate: ReadonlyNative<ts.VariableDeclaration>): boolean =>
        candidate.name.getText(parsed) === value.text
    );
    const initializer = declaration && declaration.initializer;
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
export {
  gatewayConfigEdit,
  readProviderId,
  readProviderLiteral,
  parseProviderLiteral,
};
