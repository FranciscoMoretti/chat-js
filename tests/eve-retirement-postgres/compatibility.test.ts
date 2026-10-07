/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports -- This PostgreSQL fixture verifies the application preflight against a disposable real schema. */
import { readFile } from "node:fs/promises";
import path from "node:path";

import postgres from "postgres";
import { afterAll, afterEach, expect, test } from "vitest";
import { z } from "zod";

import {
  assertEvePostgresRuntimeCompatibility,
  resolveEveStepVersion,
} from "../../apps/chat/lib/db/workflow-runtime-compatibility";
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

// oxlint-disable-next-line node/no-process-env -- Explicit disposable handoff is the only accepted database configuration for this fixture.
const handoffPath = z.string().parse(process.env.EVE_RETIREMENT_POSTGRES_FILE);
const handoff = z
  .object({ databases: z.object({ lane_d: z.url() }), root: z.string() })
  .parse(JSON.parse(await readFile(handoffPath, "utf-8")));
const owner = await readFile(path.join(handoff.root, "ownership"), "utf-8");
if (owner.trim() !== "chatjs-retirement-disposable-v1") {
  throw new Error("Disposable cluster ownership required");
}
const url = new URL(handoff.databases.lane_d);
if (
  url.hostname !== "127.0.0.1" ||
  url.pathname !== "/lane_d" ||
  url.username !== "retirement"
) {
  throw new Error("D's isolated database required");
}
const connection = postgres(url.href, { max: 1 });
const prefix = `preflight-${crypto.randomUUID()}`;
afterEach(async () => {
  await connection`delete from workflow.workflow_steps where run_id like ${`${prefix}%`}`;
  await connection`delete from workflow.workflow_runs where id like ${`${prefix}%`}`;
});
afterAll(async () => {
  await connection.end();
});

const seed = async (
  status: "pending" | "running" | "completed" | "failed" | "cancelled",
  version: string
): Promise<void> => {
  const id = `${prefix}-${status}`;
  await connection`insert into workflow.workflow_runs(id,deployment_id,status,name) values(${id},'postgres',${status},'workflow//eve//workflowEntry')`;
  await connection`insert into workflow.workflow_steps(run_id,step_id,step_name,status,attempt) values(${id},${`${id}-step`},${`step//eve@${version}//createSessionStep`},'completed',1)`;
};

test.each(["pending", "running"] as const)(
  "refuses %s incompatible continuation without writing",
  async (status) => {
    await seed(status, "0.61.0");
    const before =
      await connection`select * from workflow.workflow_runs where id like ${`${prefix}%`}`;
    await expect(
      assertEvePostgresRuntimeCompatibility(connection, "0.71.3")
    ).rejects.toThrow("incompatible with step version 0.71.3");
    const after =
      await connection`select * from workflow.workflow_runs where id like ${`${prefix}%`}`;
    expect(after).toEqual(before);
  }
);

test.each(["completed", "failed", "cancelled"] as const)(
  "allows historical-only %s run",
  async (status) => {
    await seed(status, "0.61.0");
    await expect(
      assertEvePostgresRuntimeCompatibility(connection, "0.71.3")
    ).resolves.toBeUndefined();
  }
);

test("allows matching active steps and rejects an unreviewed distribution", async () => {
  await seed("running", "0.71.3");
  await expect(
    assertEvePostgresRuntimeCompatibility(connection, "0.71.3")
  ).resolves.toBeUndefined();
  expect(resolveEveStepVersion("@chat-js/eve", "0.61.0-chatjs.0")).toBe(
    "0.61.0"
  );
  expect(() => resolveEveStepVersion("eve", "0.72.0")).toThrow(
    "Unreviewed EVE distribution"
  );
});
