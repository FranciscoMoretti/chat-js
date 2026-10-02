import { readFile } from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import type { GatewaySelection } from "../registry/gateways";

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
  let value = declaration?.initializer;
  if (value && ts.isSatisfiesExpression(value)) {
    value = value.expression;
  }
  return value && ts.isStringLiteral(value) ? value.text : undefined;
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
  let gateway: ts.PropertyAssignment | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(parsed) === "ai" &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      gateway = node.initializer.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          property.name.getText(parsed) === "gateway"
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
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
