import { readFile, readdir } from "node:fs/promises";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, expect, test, vi } from "vitest";

import {
  mcpConnector,
  mcpOAuthSession,
} from "@/chatjs/plugins/mcp/db/mcp-schema";

const postgres = new PGlite();
const database = drizzle(postgres);
vi.mock("./client", () => ({ db: database }));
vi.mock("@/chatjs/plugins/mcp/mcp-env", () => ({
  readMcpEncryptionKey: () => Buffer.alloc(32, 1).toString("base64"),
}));
const {
  deletePendingSessionByState,
  getMcpConnectorById,
  getMcpConnectorByNameId,
  getSessionByState,
} = await import("../../chatjs/plugins/mcp/db/mcp-queries");

beforeAll(async () => {
  const directory = new URL("migrations/", import.meta.url);
  const entries = await readdir(directory);
  const filenames = entries.filter((name) => name.endsWith(".sql")).toSorted();
  const migrations = await Promise.all(
    filenames.map(
      async (name) => await readFile(new URL(name, directory), "utf-8")
    )
  );
  await postgres.exec(migrations.join("\n"));
  await postgres.exec(
    `insert into "user" (id,name,email) values ('owner','owner','owner')`
  );
}, 30_000);

afterAll(async () => {
  await postgres.close();
});

test("connector lookups distinguish absent rows from owner and global records", async () => {
  const [connector] = await database
    .insert(mcpConnector)
    .values({
      name: "Owned",
      nameId: "owned",
      url: "https://mcp.example.test",
      userId: "owner",
    })
    .returning();
  expect(await getMcpConnectorById({ id: crypto.randomUUID() })).toBeNull();
  expect(await getMcpConnectorById({ id: connector.id })).toEqual(connector);
  expect(
    await getMcpConnectorByNameId({ nameId: "owned", userId: "other" })
  ).toBeNull();
  expect(
    await getMcpConnectorByNameId({ nameId: "owned", userId: "owner" })
  ).toEqual(connector);
  expect(
    await getMcpConnectorByNameId({ nameId: "owned", userId: null })
  ).toBeNull();
});

test("pending OAuth consumption returns null on replay and preserves a token winner", async () => {
  const [connector] = await database
    .insert(mcpConnector)
    .values({
      name: "OAuth",
      nameId: "oauth",
      url: "https://mcp.example.test",
      userId: "owner",
    })
    .returning();
  await database.insert(mcpOAuthSession).values([
    {
      mcpConnectorId: connector.id,
      serverUrl: connector.url,
      state: "pending",
    },
    {
      mcpConnectorId: connector.id,
      serverUrl: connector.url,
      state: "winner",
      tokens: { access_token: "fixture-token", token_type: "Bearer" },
    },
  ]);
  expect(await deletePendingSessionByState({ state: "missing" })).toBeNull();
  expect(await deletePendingSessionByState({ state: "pending" })).toMatchObject(
    { state: "pending", tokens: null }
  );
  expect(await deletePendingSessionByState({ state: "pending" })).toBeNull();
  expect(await deletePendingSessionByState({ state: "winner" })).toBeNull();
  expect(await getSessionByState({ state: "winner" })).toMatchObject({
    tokens: { access_token: "fixture-token" },
  });
});
