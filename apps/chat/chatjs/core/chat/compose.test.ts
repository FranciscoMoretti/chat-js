import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { expect, test, vi } from "vitest";
import type { ChatServerIntegration } from "@/chatjs/core/chat/contracts";
import { composeChat } from "@/chatjs/core/chat/compose";

test("history restrictions intersect, public grants combine, and empty composition stays private", async () => {
  const dialect = new PgDialect();
  const firstHistory = vi.fn(() => sql`project_id = ${"project"}`);
  const chat = composeChat([
    { historyFilter: firstHistory, publicReadFilter: () => sql`shared = true` },
    {
      historyFilter: () => sql`archived = false`,
      publicReadFilter: () => sql`published = true`,
    },
    {},
  ]);
  const history = chat.historyFilter({ projectId: "project" }, "sidebar");
  expect(firstHistory).toHaveBeenCalledWith(
    { projectId: "project" },
    "sidebar"
  );
  expect(history && dialect.sqlToQuery(history)).toMatchObject({
    sql: "(project_id = $1 and archived = false)",
    params: ["project"],
  });
  expect(dialect.sqlToQuery(chat.publicReadFilter()).sql).toBe(
    "(shared = true or published = true)"
  );
  const empty = composeChat([]);
  expect(empty.historyFilter({}, "all")).toBeUndefined();
  expect(dialect.sqlToQuery(empty.publicReadFilter()).sql).toBe("false");
  await expect(empty.links("owner", [])).resolves.toEqual(new Map());
});

test("app-owned and installed navigation adapters compose but cannot claim the same chat", async () => {
  const first = vi
    .fn<NonNullable<ChatServerIntegration["links"]>>()
    .mockResolvedValue(
      new Map([
        ["chat", { href: "/project/p/chat/chat", parentHref: "/project/p" }],
      ])
    );
  const second = vi
    .fn<NonNullable<ChatServerIntegration["links"]>>()
    .mockResolvedValue(
      new Map([["other", { href: "/inbox/other", parentHref: "/inbox" }]])
    );
  const chat = composeChat([{ links: first }, { links: second }]);
  expect(await chat.links("owner", ["chat", "other"])).toEqual(
    new Map([
      ["chat", { href: "/project/p/chat/chat", parentHref: "/project/p" }],
      ["other", { href: "/inbox/other", parentHref: "/inbox" }],
    ])
  );
  expect(first).toHaveBeenCalledWith("owner", ["chat", "other"]);
  expect(second).toHaveBeenCalledAfter(first);
  await expect(
    composeChat([{ links: first }, { links: first }]).links("owner", ["chat"])
  ).rejects.toThrow("Multiple plugins supplied navigation for chat chat");
});
