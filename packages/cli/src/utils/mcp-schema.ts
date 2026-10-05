// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

import ts from "typescript";

import { preflight } from "./preflight";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- TypeScript owns the mutable AST nodes passed to these read-only inspection callbacks. */
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
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      (declaration): boolean =>
        declaration.name.getText(parsed) === "mcpConnector"
    );
  const [, columns] =
    connector?.initializer && ts.isCallExpression(connector.initializer)
      ? connector.initializer.arguments
      : [];
  if (
    // oxlint-disable-next-line no-undefined -- A parsed call can omit the second argument even though TypeScript indexes its NodeArray as an Expression.
    columns !== undefined &&
    ts.isObjectLiteralExpression(columns) &&
    columns.properties.some(
      (property): boolean =>
        ts.isPropertyAssignment(property) &&
        (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
        property.name.text === "requireApproval"
    )
  ) {
    return;
  }
  throw new Error(
    'MCP requires mcpConnector.requireApproval in lib/db/schema.ts. Add requireApproval: boolean("requireApproval").notNull().default(false) to the connector columns, then run your db:generate script, review the generated migration, and run your db:migrate script against the intended database using your package manager before retrying chat-js add mcp. No source was installed. See https://chatjs.dev/docs/features/mcp for the existing-app upgrade steps.'
  );
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */

export { assertMcpApprovalSchema };
