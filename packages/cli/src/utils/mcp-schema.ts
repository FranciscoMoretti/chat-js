import path from "node:path";
import { readFile } from "node:fs/promises";

import ts from "typescript";

import { preflight } from "./preflight";

// Read native compiler nodes without writing their recursive parent graph.
interface CompilerNodeReader extends Readonly<Omit<ts.Node, "parent">> {
  readonly parent: CompilerNodeReader;
}

interface CompilerDeclarationReader extends CompilerNodeReader {
  readonly name: Readonly<Pick<ts.Node, "getText">>;
  readonly initializer?: CompilerNodeReader;
}

const assertMcpApprovalSchema = async (cwd: string): Promise<void> => {
  const file = "lib/db/schema.ts";
  await preflight(cwd, [file]);
  const source = await readFile(path.join(cwd, file), "utf-8");
  const parsed = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const connector = parsed.statements
    .filter(ts.isVariableStatement)
    .flatMap(
      (statement: {
        readonly declarationList: {
          readonly declarations: readonly CompilerDeclarationReader[];
        };
      }) => statement.declarationList.declarations
    )
    .find(
      (declaration: {
        readonly name: Readonly<Pick<ts.Node, "getText">>;
      }): boolean => declaration.name.getText(parsed) === "mcpConnector"
    );
  if (
    connector &&
    connector.initializer &&
    ts.isCallExpression(connector.initializer)
  ) {
    const [, columns] = connector.initializer.arguments;
    if (
      typeof columns === "object" &&
      ts.isObjectLiteralExpression(columns) &&
      columns.properties.some(
        (property: CompilerNodeReader): boolean =>
          ts.isPropertyAssignment(property) &&
          (ts.isIdentifier(property.name) ||
            ts.isStringLiteral(property.name)) &&
          property.name.text === "requireApproval"
      )
    ) {
      return;
    }
  }
  throw new Error(
    'MCP requires mcpConnector.requireApproval in lib/db/schema.ts. Add requireApproval: boolean("requireApproval").notNull().default(false) to the connector columns, then run your db:generate script, review the generated migration, and run your db:migrate script against the intended database using your package manager before retrying chat-js add mcp. No source was installed. See https://chatjs.dev/docs/features/mcp for the existing-app upgrade steps.'
  );
};
export { assertMcpApprovalSchema };
