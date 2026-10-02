import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import type { GatewaySelection } from "../registry/gateways";

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

export const readProviderId = async (
  cwd: string,
  kind: "gateway" | "storage"
) => {
  const file =
    kind === "gateway"
      ? "lib/ai/gateway-model-defaults.ts"
      : "lib/storage-options.ts";
  const source = await readFile(path.join(cwd, file), "utf-8").catch(
    (error: unknown) => {
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
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => item.name.getText(parsed) === name);
  if (!source.trim()) {
    return;
  }
  const value = declaration?.initializer && unwrap(declaration.initializer);
  if (!value || !ts.isStringLiteralLike(value)) {
    throw new Error(
      `Cannot determine the installed ${kind} in ${file}. Use a literal ${name} before automatic replacement, or integrate the provider manually.`
    );
  }
  return value.text;
};

/** Change the discriminator; preserve editable model/parameter selections for the user's new gateway. */
export const gatewayConfigEdit = async (
  cwd: string,
  selection: GatewaySelection
) => {
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
    // oxlint-disable-next-line eslint/no-bitwise -- TypeScript represents declaration modifiers as a bitmask.
    .filter((statement) => statement.declarationList.flags & ts.NodeFlags.Const)
    .flatMap((statement) => [...statement.declarationList.declarations]);
  const seen = new Set<string>();
  const resolve = (input: ts.Expression): ts.Expression | undefined => {
    const value = unwrap(input);
    if (!ts.isIdentifier(value)) {
      return value;
    }
    if (seen.has(value.text)) {
      return;
    }
    seen.add(value.text);
    // A binding used elsewhere may have its object mutated before configuration.
    // Follow only a declaration and its single use in the active config chain.
    let references = 0;
    const visit = (node: ts.Node) => {
      if (ts.isIdentifier(node) && node.text === value.text) {
        references += 1;
      }
      ts.forEachChild(node, visit);
    };
    visit(parsed);
    if (references !== 2) {
      return;
    }
    const initializer = declarations.find(
      (declaration) => declaration.name.getText(parsed) === value.text
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
      ? config.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            property.name
              .getText(parsed)
              .replaceAll('"', "")
              .replaceAll("'", "") === "ai"
        )
      : undefined;
  const ai = aiProperty && unwrap(aiProperty.initializer);
  const gateway =
    ai && ts.isObjectLiteralExpression(ai)
      ? ai.properties.find(
          (property): property is ts.PropertyAssignment =>
            ts.isPropertyAssignment(property) &&
            property.name
              .getText(parsed)
              .replaceAll('"', "")
              .replaceAll("'", "") === "gateway"
        )
      : undefined;
  if (!gateway) {
    throw new Error(
      "chat.config.ts must have a literal ai.gateway to replace the gateway automatically. Integrate the new gateway configuration manually."
    );
  }
  return (
    source.slice(0, gateway.initializer.getStart(parsed)) +
    JSON.stringify(selection.definition.id) +
    source.slice(gateway.initializer.end)
  );
};
