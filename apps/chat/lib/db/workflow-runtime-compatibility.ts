import type { Sql } from "postgres";

// The distribution suffix is not part of the fork's compiled step identities.
const supportedStepVersions = new Map([
  ["@chat-js/eve@0.61.0-chatjs.0", "0.61.0"],
  ["eve@0.71.3", "0.71.3"],
]);

const resolveEveStepVersion = (name: string, version: string): string => {
  const stepVersion = supportedStepVersions.get(`${name}@${version}`);
  if (typeof stepVersion !== "string") {
    throw new TypeError(
      "Unreviewed EVE distribution. Verify durable step compatibility before deploying this package."
    );
  }
  return stepVersion;
};

const assertEvePostgresRuntimeCompatibility = async (
  connection: Sql,
  expectedStepVersion: string
): Promise<void> => {
  const [schema] = await connection<{ available: boolean }[]>`
    select to_regclass('workflow.workflow_runs') is not null
      and to_regclass('workflow.workflow_steps') is not null as available
  `;
  if (!schema?.available) {
    return;
  }
  const mismatches = await connection<{ id: string; stepName: string }[]>`
    select r.id, s.step_name as "stepName"
    from workflow.workflow_runs r
    join workflow.workflow_steps s on s.run_id = r.id
    where r.status in ('pending', 'running')
      and r.name like 'workflow//eve%'
      and s.step_name like 'step//eve@%'
      and split_part(s.step_name, '//', 2) <> ${`eve@${expectedStepVersion}`}
    order by r.id, s.step_name limit 1
  `;
  const [mismatch] = mismatches;
  const noMismatches = 0;
  if (mismatches.length > noMismatches) {
    throw new Error(
      `Active EVE run ${mismatch.id} contains ${mismatch.stepName}, incompatible with step version ${expectedStepVersion}. Retire the selected prelaunch sessions on their original runtime with verified history archives before cutover, or use a reviewed migration. Do not rewrite event logs or retry admission.`
    );
  }
};
export { assertEvePostgresRuntimeCompatibility, resolveEveStepVersion };
