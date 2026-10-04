import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

/* oxlint-disable import/no-relative-parent-imports -- These relative imports connect package-local modules and remain valid in the published standalone layout. */
import type { GatewaySelection } from "../registry/gateways";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const unwrap = (expression: ts.Expression): ts.Expression => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

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
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
// Object properties apply in order. A later spread or computed key can override
// a named property; only a subsequent explicit assignment makes it safe again.
const activeProperty = (object: ts.ObjectLiteralExpression, name: string) => {
  let selected: ts.PropertyAssignment | undefined;
  for (const property of object.properties) {
    if (
      ts.isSpreadAssignment(property) ||
      (property.name && ts.isComputedPropertyName(property.name))
    ) {
      selected = undefined;
      continue;
    }
    if (
      property.name &&
      (ts.isIdentifier(property.name) ||
        ts.isStringLiteralLike(property.name)) &&
      property.name.text === name
    ) {
      selected = ts.isPropertyAssignment(property) ? property : undefined;
    }
  }
  return selected;
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const readProviderId = async (cwd: string, kind: "gateway" | "storage") => {
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
    .flatMap((statement) => statement.declarationList.declarations)
    .find((item): boolean => item.name.getText(parsed) === name);
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable jsdoc/require-param -- This comment documents the API invariant; parameter names and TypeScript annotations describe the inputs without duplicating them in tags. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
/** Change the discriminator; preserve editable model/parameter selections for the user's new gateway. */
const gatewayConfigEdit = async (
  cwd: string,
  selection: GatewaySelection
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
      (statement): number =>
        // oxlint-disable-next-line eslint/no-bitwise -- TypeScript represents declaration modifiers as a bitmask.
        statement.declarationList.flags & ts.NodeFlags.Const
    )
    .flatMap((statement) => statement.declarationList.declarations);
  const seen = new Set<string>();
  const resolve = (input: ts.Expression): ts.Expression | undefined => {
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
    let references = 0;
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node) && node.text === value.text) {
        references += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (references !== 2) {
      // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
      return;
    }
    const initializer = declarations.find(
      (declaration): boolean => declaration.name.getText(parsed) === value.text
    )?.initializer;
    return initializer && resolve(initializer);
  };
  const expression = exported && resolve(exported.expression);
  const config =
    expression && ts.isCallExpression(expression)
      ? ts.isIdentifier(expression.expression) &&
        expression.expression.text === "defineConfig" &&
        expression.arguments[0] &&
        resolve(expression.arguments[0])
      : expression;
  const aiProperty =
    config && ts.isObjectLiteralExpression(config)
      ? activeProperty(config, "ai")
      : undefined;
  const ai = aiProperty && unwrap(aiProperty.initializer);
  const gateway =
    ai && ts.isObjectLiteralExpression(ai)
      ? activeProperty(ai, "gateway")
      : undefined;
  if (!gateway) {
    throw new Error(
      "chat.config.ts must have a literal ai.gateway without later spreads or computed keys that could override it to replace the gateway automatically. Integrate the new gateway configuration manually."
    );
  }
  return (
    source.slice(0, gateway.initializer.getStart(parsed)) +
    JSON.stringify(selection.definition.id) +
    source.slice(gateway.initializer.end)
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable jsdoc/require-param */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */
export { gatewayConfigEdit, readProviderId, readProviderLiteral };
