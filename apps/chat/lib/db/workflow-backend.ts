import type { Sql } from "postgres";

/** Refuse a deployment that would reinterpret existing run IDs in another world. */
export const ensureWorkflowBackend = async (connection: Sql, world: string) => {
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
