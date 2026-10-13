import { dehydrate } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { preloadQuery } from "./preload-query";
import { makeQueryClient } from "./query-client";

test("preloading keeps pending queries hydratable and reuses cached results", async () => {
  const client = makeQueryClient();
  const queryKey = ["preload"];
  const queryFn = vi.fn<() => Promise<string>>().mockResolvedValue("ready");
  const pending = preloadQuery(client.query({ queryKey, queryFn }));
  expect(dehydrate(client).queries[0]?.state.status).toBe("pending");
  await pending;
  expect(client.getQueryData(queryKey)).toBe("ready");
  await preloadQuery(client.query({ queryKey, queryFn }));
  expect(queryFn).toHaveBeenCalledOnce();
  client.clear();
});

test("preloading swallows failures while preserving the cached error state", async () => {
  const client = makeQueryClient();
  const queryKey = ["failed-preload"];
  const failure = new Error("service unavailable");
  const queryFn = vi.fn<() => Promise<string>>().mockRejectedValue(failure);
  await preloadQuery(client.query({ queryKey, queryFn }));
  expect(client.getQueryState(queryKey)?.status).toBe("error");
  expect(client.getQueryState(queryKey)?.error).toBe(failure);
  expect(queryFn).toHaveBeenCalledOnce();
  client.clear();
});
