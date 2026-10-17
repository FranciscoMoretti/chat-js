import { z } from "zod";
import { beforeEach, expect, test, vi } from "vitest";
import { GET } from "../../apps/chat/app/api/eve/[...path]/route";

const mocks = vi.hoisted(() => ({
  bound: vi.fn(),
  canSpend: vi.fn(),
  eveRequest: vi.fn(),
  prepare: vi.fn(),
  principal: vi.fn(),
  reconcile: vi.fn(),
  referenceFiles: vi.fn(),
}));

vi.mock("@/lib/db/credits", () => ({ canSpend: mocks.canSpend }));
vi.mock("@/lib/db/eve-files", () => ({
  referenceEveFiles: mocks.referenceFiles,
}));
vi.mock("@/lib/db/eve-queries", () => ({
  getBoundEveConversationForSession: mocks.bound,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/guest-message-admission", () => ({
  admitGuestMessage: vi.fn(),
  settleGuestMessage: vi.fn(),
}));
vi.mock("@/lib/eve/model-selection", () => ({
  loadEveModelDefinition: vi.fn(),
}));
vi.mock("@/lib/eve/prepare-message", () => ({
  prepareEveMessage: mocks.prepare,
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/eve/reconcile-usage", () => ({
  reconcileEveOwnerUsage: mocks.reconcile,
}));
vi.mock("@/lib/eve/server", () => ({ eveRequest: mocks.eveRequest }));

const host = process.env.EVE_STREAM_PROOF_HOST;
const sessionId = process.env.EVE_STREAM_PROOF_SESSION;
if (host === undefined || sessionId === undefined) {
  throw new Error("Run through proof.mjs");
}
const endpoint = `${host}/eve/v1/session/${sessionId}/stream`;
const frames = (text: string) =>
  text
    .split("\n")
    .filter(Boolean)
    .map((line) => z.record(z.string(), z.unknown()).parse(JSON.parse(line)));
const request = async (
  query: string,
  headers: Record<string, string> = {},
  signal?: AbortSignal
) =>
  await GET(
    new Request(
      `http://localhost:3790/api/eve/v1/session/${sessionId}/stream?${query}`,
      { headers, signal }
    ),
    {
      params: Promise.resolve({ path: ["v1", "session", sessionId, "stream"] }),
    }
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.bound.mockImplementation((owner: string, session: string) =>
    owner === "owner" && session === sessionId
      ? { id: "conversation" }
      : undefined
  );
  mocks.eveRequest.mockImplementation(
    async (owner: string, route: string, init: RequestInit) => {
      if (owner !== "owner" || init.method !== "GET") {
        throw new Error("Unexpected authority or write");
      }
      return await fetch(
        `${host}${route.replace("/eve/chat/", "/eve/")}`,
        init
      );
    }
  );
});
test("bounded native history and exact reconnect preserve events, tail and relay headers", async () => {
  const direct = await fetch(`${endpoint}?follow=false`);
  const expected = frames(await direct.text());
  expect(expected.length).toBeGreaterThan(1);
  const response = await request("follow=false");
  expect(response.status).toBe(200);
  for (const header of [
    "content-type",
    "x-eve-session-id",
    "x-eve-stream-format",
    "x-eve-stream-version",
    "x-eve-stream-tail-index",
  ]) {
    expect(response.headers.get(header)).toBe(direct.headers.get(header));
  }
  expect(frames(await response.text())).toEqual(expected);
  const cursor = Math.floor(expected.length / 2);
  const resumed = await request(
    `follow=false&startIndex=${cursor}&streamControlVersion=1`
  );
  expect(frames(await resumed.text())).toEqual(expected.slice(cursor));
  const empty = await request(`follow=false&startIndex=${expected.length}`);
  expect(frames(await empty.text())).toEqual([]);
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.canSpend).not.toHaveBeenCalled();
});
test("idle heartbeat and real lease end do not advance the event cursor or resend a command", async () => {
  const baseline = await fetch(`${endpoint}?follow=false`);
  const events = frames(await baseline.text());
  const started = Date.now();
  const response = await request(
    `startIndex=${events.length}&streamControlVersion=1`
  );
  const body = await response.text();
  expect(Date.now() - started).toBeGreaterThanOrEqual(59_000);
  expect(body.split("\n").filter((line) => line === "").length).toBeGreaterThan(
    3
  );
  expect(frames(body)).toHaveLength(1);
  expect(frames(body)[0]).toMatchObject({
    $eve: "stream.lease-ended",
    version: 1,
  });
  const resumed = await request(`follow=false&startIndex=${events.length}`);
  expect(frames(await resumed.text())).toEqual([]);
  expect(mocks.eveRequest).toHaveBeenCalledTimes(2);
});
test("browser cancellation aborts the upstream read and permits a read-only reconnect", async () => {
  const controller = new AbortController();
  const response = await request(
    "streamControlVersion=1",
    {},
    controller.signal
  );
  const reader = response.body?.getReader();
  if (reader === undefined) {
    throw new Error("Missing stream body");
  }
  await reader.read();
  controller.abort();
  await expect(
    (async () => {
      let result = await reader.read();
      while (!result.done) {
        // oxlint-disable-next-line eslint/no-await-in-loop -- Consume one ordered reader until cancellation reaches it.
        result = await reader.read();
      }
    })()
  ).rejects.toThrow();
  const reconnect = await request("follow=false");
  expect(reconnect.status).toBe(200);
  await reconnect.text();
});
test.each([
  { origin: "https://foreign.example" },
  { "sec-fetch-site": "cross-site" },
])("rejects cross-origin reads before native dispatch", async (headers) => {
  const response = await request("follow=false", headers);
  expect(response.status).toBe(403);
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});
test("rejects a foreign owner before native dispatch", async () => {
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "foreign" });
  const response = await request("follow=false");
  expect(response.status).toBe(404);
  expect(mocks.eveRequest).not.toHaveBeenCalled();
});
