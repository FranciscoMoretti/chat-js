import type { Sql } from "postgres";

/* oxlint-disable jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * import/no-named-export (#527): Preserve the named ensureWorkflowBackend API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): ensureWorkflowBackend remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): ensureWorkflowBackend's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * oxc/no-async-await (#540): ensureWorkflowBackend sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * typescript/prefer-readonly-parameter-types (#565): ensureWorkflowBackend accepts connection: Sql; tx; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): ensureWorkflowBackend intentionally keeps the existing falsy-value behavior of registered; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Refuse a deployment that would reinterpret existing run IDs in another world. */
export const ensureWorkflowBackend = async (
  connection: Sql,
  world: string
): Promise<void> => {
  await connection.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended('eve-workflow-backend', 0))`;
    const [registered] = await tx<{ world: string }[]>`
      select world from "EveWorkflowBackend" where id = 1
    `;
    if (registered && registered.world !== world) {
      throw new Error(
        `This application database belongs to ${registered.world}, not ${world}. Deployment stopped to preserve existing conversations. Keep the previous deployment and database intact; use a fresh application database or complete a verified workflow migration before cutover.`
      );
    }
    await tx`insert into "EveWorkflowBackend" (id, world) values (1, ${world}) on conflict do nothing`;
  });
};
/* oxlint-enable jsdoc/require-param, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
