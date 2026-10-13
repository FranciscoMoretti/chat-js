import { Schema } from "@world-postgres-test/dist/drizzle/index.js";
import { createStreamer } from "@world-postgres-test/dist/streamer.js";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { Pool } from "pg";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import { readEvePostgresStreamPositions } from "@/lib/eve/lifecycle/postgres/eve-stream-positions";

import { env } from "../lib/env";
import { assertEveTestDatabase } from "./eve-test-database";

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
afterAll(async () => {
  await streamer.close();
  await database.delete(Schema.streams).where(eq(Schema.streams.runId, runId));
  await pool.end();
  await positionConnection.end();
});
const encoder = new TextEncoder();

const fixture = async (
  values: readonly string[],
  closed = true,
  name: string = crypto.randomUUID()
): Promise<string> => {
  /* oxlint-disable eslint/no-await-in-loop -- Stream chunks must be appended in fixture order to assert exact replay content. */
  for (const value of values) {
    await streamer.streams.write(runId, name, encoder.encode(value));
  }
  /* oxlint-enable eslint/no-await-in-loop */
  if (closed) {
    await streamer.streams.close(runId, name);
  }
  return name;
};

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
  const streamInfo = await streamer.streams.getInfo(runId, name);
  expect(updated.get(sessionId)).toBe(streamInfo.tailIndex + 1);
  expect(await readEvePostgresStreamPositions(positionConnection, [])).toEqual(
    new Map()
  );
});

const read = async (name: string, index: number) => {
  const stream = await streamer.streams.get(runId, name, index);
  const result: string[] = [];
  for await (const chunk of stream) {
    result.push(new TextDecoder().decode(chunk));
  }
  return result;
};

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

test("zero, relative-tail, and empty streams preserve their sequences", async () => {
  const name = await fixture(["one", "two", "three"]);
  expect(await read(name, 0)).toEqual(["one", "two", "three"]);
  expect(await read(name, -1)).toEqual(["three"]);
  expect(await read(name, -20)).toEqual(["one", "two", "three"]);
  expect(await read(await fixture([]), 0)).toEqual([]);
});

test("a resumed live stream delivers appended chunks once and terminates at EOF", async () => {
  const name = await fixture(["consumed"], false);
  const stream = await streamer.streams.get(runId, name, 1);
  const reader = stream.getReader();
  try {
    const next = reader.read();
    await streamer.streams.write(runId, name, encoder.encode("new"));
    const nextChunk = await next;
    expect(new TextDecoder().decode(nextChunk.value)).toBe("new");
    await streamer.streams.close(runId, name);
    const completedRead = await reader.read();
    expect(completedRead.done).toBe(true);
  } finally {
    await reader.cancel();
  }
});

test("a future cursor skips new chunks until its absolute index is reached", async () => {
  const name = await fixture(["zero"], false);
  const stream = await streamer.streams.get(runId, name, 3);
  const reader = stream.getReader();
  try {
    const next = reader.read();
    await streamer.streams.write(runId, name, encoder.encode("one"));
    await streamer.streams.write(runId, name, encoder.encode("two"));
    await streamer.streams.write(runId, name, encoder.encode("three"));
    const nextChunk = await next;
    expect(new TextDecoder().decode(nextChunk.value)).toBe("three");
    await streamer.streams.close(runId, name);
    const completedRead = await reader.read();
    expect(completedRead.done).toBe(true);
  } finally {
    await reader.cancel();
  }
});
