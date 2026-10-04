import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import type { GatewaySelection } from "#cli/registry/gateways";

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
      selected = ts.isPropertyAssignment(property) ? property : undefined;
    }
  }
  return selected;
};
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
const readProviderId = async (
  cwd: string,
  kind: "gateway" | "storage"
): Promise<string | undefined> => {
  const file =
    kind === "gateway"
      ? "lib/ai/gateway-model-defaults.ts"
      : "lib/storage-options.ts";
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
  const name = kind === "gateway" ? "gatewayType" : "storageId";
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

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/**
 * Change the discriminator; preserve editable model/parameter selections.
 * @param cwd Project directory containing chat.config.ts.
 * @param selection Gateway whose ID replaces the active discriminator.
 * @returns Updated configuration source without writing the file.
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
      // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
      return;
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
      // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
      return;
    }
    const initializer = declarations.find(
      (declaration: ReadonlyNative<ts.VariableDeclaration>): boolean =>
        declaration.name.getText(parsed) === value.text
    )?.initializer;
    return initializer === undefined ? undefined : resolve(initializer);
  };
  const expression =
    exported === undefined ? undefined : resolve(exported.expression);
  const configArgument =
    expression !== undefined &&
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "defineConfig"
      ? expression.arguments[CONFIG_ARGUMENT_INDEX]
      : undefined;
  const resolvedConfigArgument =
    configArgument === undefined ? undefined : resolve(configArgument);
  const config =
    expression !== undefined && ts.isCallExpression(expression)
      ? resolvedConfigArgument
      : expression;
  const aiProperty =
    config !== undefined && ts.isObjectLiteralExpression(config)
      ? activeProperty(config, "ai")
      : undefined;
  const ai =
    aiProperty === undefined ? undefined : unwrap(aiProperty.initializer);
  const gateway =
    ai !== undefined && ts.isObjectLiteralExpression(ai)
      ? activeProperty(ai, "gateway")
      : undefined;
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
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
export { gatewayConfigEdit, readProviderId };
