import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { optimisticEveMetadata } from "./optimistic-metadata";

describe("optimistic logical chat metadata", () => {
  it("updates every paginated list and branch alias, then rolls back only the failed field", async () => {
    const cache = new QueryClient();
    const row = { id: "chat", isPinned: false, title: "Original" };
    const other = { id: "other", isPinned: false, title: "Other" };
    const list = {
      pageParams: [null, "next"],
      pages: [
        { items: [other], nextCursor: "next" },
        { items: [row], nextCursor: null },
      ],
    };
    cache.setQueryData(["list", "all"], list);
    cache.setQueryData(["list", "project"], list);
    cache.setQueryData(["get", "chat"], {
      chatId: "chat",
      isPinned: false,
      title: row.title,
    });
    cache.setQueryData(["get", "branch"], {
      chatId: "chat",
      isPinned: false,
      title: row.title,
    });
    const rollback = await optimisticEveMetadata(
      cache,
      ["list"],
      ["get"],
      "chat",
      { title: "Renamed" }
    );
    for (const key of [
      ["get", "chat"],
      ["get", "branch"],
    ]) {
      expect(cache.getQueryData(key)).toMatchObject({ title: "Renamed" });
    }
    expect(cache.getQueryData(["list", "project"])).toMatchObject({
      pages: [{ items: [other] }, { items: [{ title: "Renamed" }] }],
    });
    await optimisticEveMetadata(cache, ["list"], ["get"], "chat", {
      isPinned: true,
    });
    await optimisticEveMetadata(cache, ["list"], ["get"], "other", {
      title: "Other renamed",
    });
    rollback();
    expect(cache.getQueryData(["get", "branch"])).toMatchObject({
      isPinned: true,
      title: "Original",
    });
    expect(cache.getQueryData(["list", "all"])).toMatchObject({
      pages: [
        { items: [{ title: "Other renamed" }] },
        { items: [{ isPinned: true, title: "Original" }] },
      ],
    });
  });
  it("does not clobber a newer same-field edit on rollback", async () => {
    const cache = new QueryClient();
    cache.setQueryData(["get", "chat"], {
      chatId: "chat",
      isPinned: false,
      title: "Original",
    });
    const rollback = await optimisticEveMetadata(
      cache,
      ["list"],
      ["get"],
      "chat",
      { title: "First" }
    );
    await optimisticEveMetadata(cache, ["list"], ["get"], "chat", {
      title: "Second",
    });
    rollback();
    expect(cache.getQueryData(["get", "chat"])).toMatchObject({
      title: "Second",
    });
  });
});
