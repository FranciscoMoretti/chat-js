// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile } from "node:fs/promises";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";
/* oxlint-enable sort-imports */

import ts from "typescript";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { preflight } from "./preflight";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve assertMcpApprovalSchema's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */

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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript supplies its native VariableStatement; the declaration list contains SDK-owned mutable AST nodes.
    .flatMap((statement) => statement.declarationList.declarations)
    .find(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native declaration names expose getText(parsed) through the TypeScript AST contract.
      (declaration): boolean =>
        declaration.name.getText(parsed) === "mcpConnector"
    );
  const [, columns] =
    // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading initializer from connector; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.; no-ternary: Keep [, columns] as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    connector?.initializer && ts.isCallExpression(connector.initializer)
      ? connector.initializer.arguments
      : [];
  if (
    // oxlint-disable-next-line no-undefined -- A parsed call can omit the second argument even though TypeScript indexes its NodeArray as an Expression.
    columns !== undefined &&
    ts.isObjectLiteralExpression(columns) &&
    columns.properties.some(
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- TypeScript property predicates consume native mutable Node shapes; a recursive readonly projection would not satisfy those SDK parameters.
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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (assertMcpApprovalSchema); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { assertMcpApprovalSchema };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
