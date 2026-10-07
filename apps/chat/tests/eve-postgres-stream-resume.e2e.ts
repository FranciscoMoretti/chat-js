/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "@/lib/eve/lifecycle/postgres/eve-stream-positions"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
import { Schema } from "@world-postgres-test/dist/drizzle/index.js";
import { createStreamer } from "@world-postgres-test/dist/streamer.js";
import { eq } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { drizzle } from "drizzle-orm/node-postgres";
/* oxlint-enable sort-imports */
/* oxlint-disable eslint/func-style -- Hoisted test helpers keep scenario setup readable and stable. */
/* oxlint-disable eslint/no-await-in-loop -- Integration steps and transaction fixtures intentionally run in order. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Pool } from "pg";
/* oxlint-enable sort-imports */
import postgres from "postgres";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { afterAll, expect, test } from "vitest";
/* oxlint-enable sort-imports */

import { readEvePostgresStreamPositions } from "@/lib/eve/lifecycle/postgres/eve-stream-positions";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "../lib/env";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
const pool = new Pool({ connectionString: env.DATABASE_URL, max: 3 });
const positionConnection = postgres(env.DATABASE_URL, { max: 1 });
const queries: string[] = [];
const database = drizzle(pool, {
  logger: {
    logQuery(query): void {
      queries.push(query);
    },
  },
  schema: Schema,
});
const streamer = createStreamer(pool, database);
const runId = `resume-fixture-${crypto.randomUUID()}`;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  await streamer.close();
  await database.delete(Schema.streams).where(eq(Schema.streams.runId, runId));
  await pool.end();
  await positionConnection.end();
});
/* oxlint-enable oxc/no-async-await */
const encoder = new TextEncoder();
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fixture's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types --
 * typescript/prefer-readonly-parameter-types (#565): fixture accepts values: string[]; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
async function fixture(
  values: string[],
  closed = true,
  name: string = crypto.randomUUID()
): Promise<string> {
  for (const value of values) {
    await streamer.streams.write(runId, name, encoder.encode(value));
  }
  if (closed) {
    await streamer.streams.close(runId, name);
  }
  return name;
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("batched default-stream positions match the provider without counting EOF or oth keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("batched default-stream positions match the provider without counting EOF or oth uses 5, 100_000, 1, 2, 0, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("batched default-stream positions match the provider without counting EOF or other namespaces", async () => {
  const sessionId = `wrun_${crypto.randomUUID()}`;
  const emptySessionId = `wrun_${crypto.randomUUID()}`;
  const missingSessionId = `wrun_${crypto.randomUUID()}`;
  const name = `strm_${sessionId.slice(5)}_user`;
  const emptyName = `strm_${emptySessionId.slice(5)}_user`;
  await fixture(["x".repeat(100_000), "suffix"], false, name);
  await fixture(["checkpoint"], true, `${name}_checkpoint`);
  await fixture([], true, emptyName);
  const ids = [sessionId, emptySessionId, missingSessionId];
  const positions = await readEvePostgresStreamPositions(
    positionConnection,
    ids
  );
  const info = await streamer.streams.getInfo(runId, name);
  expect(positions.get(sessionId)).toBe(info.tailIndex + 1);
  expect(positions.get(sessionId)).toBe(2);
  expect(positions.get(emptySessionId)).toBe(0);
  expect(positions.has(missingSessionId)).toBe(false);

  await streamer.streams.write(runId, name, encoder.encode("appended"));
  await streamer.streams.close(runId, name);
  const updated = await readEvePostgresStreamPositions(positionConnection, ids);
  expect(updated.get(sessionId)).toBe(3);
  expect(updated.get(sessionId)).toBe(
    (await streamer.streams.getInfo(runId, name)).tailIndex + 1
  );
  expect(await readEvePostgresStreamPositions(positionConnection, [])).toEqual(
    new Map()
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve read's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable max-statements, no-magic-numbers */
/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep read's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
async function read(name: string, index: number) {
  const stream = await streamer.streams.get(runId, name, index);
  const reader = stream.getReader();
  const result: string[] = [];
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) {
        return result;
      }
      result.push(new TextDecoder().decode(next.value));
    }
  } finally {
    await reader.cancel();
  }
}
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("resume excludes consumed payloads in SQL, including an at-tail read") uses 100_000, 2, 0, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("resume excludes consumed payloads in SQL, including an at-tail read", async () => {
  const name = await fixture([
    "x".repeat(100_000),
    "y".repeat(100_000),
    "suffix",
  ]);
  queries.length = 0;
  expect(await read(name, 2)).toEqual(["suffix"]);
  const selected = queries.filter((query) => query.startsWith("select"));
  expect(
    selected.some(
      (query) => query.includes('select "id"') && query.includes("offset")
    )
  ).toBe(true);
  const payloadReads = selected.filter(
    (query) => query.includes('"data"') && query.includes("order by")
  );
  expect(payloadReads.length).toBeGreaterThan(0);
  expect(payloadReads.every((query) => query.includes('"id" >'))).toBe(true);
  expect(await read(name, 3)).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("zero, relative-tail, and empty streams preserve their sequences") uses 0, -1, -20 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("zero, relative-tail, and empty streams preserve their sequences", async () => {
  const name = await fixture(["one", "two", "three"]);
  expect(await read(name, 0)).toEqual(["one", "two", "three"]);
  expect(await read(name, -1)).toEqual(["three"]);
  expect(await read(name, -20)).toEqual(["one", "two", "three"]);
  expect(await read(await fixture([]), 0)).toEqual([]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): test("a resumed live stream delivers appended chunks once and terminates at EOF") uses 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("a resumed live stream delivers appended chunks once and terminates at EOF", async () => {
  const name = await fixture(["consumed"], false);
  const stream = await streamer.streams.get(runId, name, 1);
  const reader = stream.getReader();
  try {
    const next = reader.read();
    await streamer.streams.write(runId, name, encoder.encode("new"));
    expect(new TextDecoder().decode((await next).value)).toBe("new");
    await streamer.streams.close(runId, name);
    expect((await reader.read()).done).toBe(true);
  } finally {
    await reader.cancel();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable max-statements, no-magic-numbers --
 * max-statements (#512): test("a future cursor skips new chunks until its absolute index is reached") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("a future cursor skips new chunks until its absolute index is reached") uses 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 */
test("a future cursor skips new chunks until its absolute index is reached", async () => {
  const name = await fixture(["zero"], false);
  const stream = await streamer.streams.get(runId, name, 3);
  const reader = stream.getReader();
  try {
    const next = reader.read();
    await streamer.streams.write(runId, name, encoder.encode("one"));
    await streamer.streams.write(runId, name, encoder.encode("two"));
    await streamer.streams.write(runId, name, encoder.encode("three"));
    expect(new TextDecoder().decode((await next).value)).toBe("three");
    await streamer.streams.close(runId, name);
    expect((await reader.read()).done).toBe(true);
  } finally {
    await reader.cancel();
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers */
