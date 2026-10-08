import { beforeEach, expect, it, vi } from "vitest";

import { POST } from "./route";

const HTTP_STATUS = {
  accepted: 202,
  badRequest: 400,
  conflict: 409,
  forbidden: 403,
  notFound: 404,
  ok: 200,
  unauthorized: 401,
};
interface CapturedRequestInit {
  readonly body: string;
  readonly method: string;
  readonly signal: Readonly<AbortSignal>;
}
type CaptureCall = readonly [
  owner: string,
  path: string,
  init: Readonly<CapturedRequestInit>,
];

const mocks = vi.hoisted(() => ({
  capture:
    vi.fn<
      (
        owner: string,
        path: string,
        init: CapturedRequestInit
      ) => Promise<Response>
    >(),
  principal: vi.fn(),
  read: vi.fn(),
  ready: vi.fn(),
  source: vi.fn(),
}));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/db/eve-queries", () => ({ getEveConversation: mocks.source }));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/lib/eve/server", () => ({ eveRequest: mocks.capture }));
vi.mock("@/lib/eve/checkpoint-readiness", () => ({
  readEveCheckpoint: mocks.read,
  waitForEveCheckpoint: mocks.ready,
}));
const id = "87c09cfc-acad-4b71-8ff4-e799f383ac98";
const input = {
  beforeTurnId: "turn_1",
  checkpointId: "8f644d88-b2df-48b3-8c25-922e9ba31f30",
};
const context = { params: Promise.resolve({ id }) };
const request = (
  origin = "http://localhost:3790",
  body: unknown = input
): Request =>
  new Request(`${origin}/api/agent-conversations/${id}/checkpoint`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.source.mockResolvedValue({
    sessionId: "native-source",
    state: "bound",
  });
  mocks.read.mockResolvedValue(false);
  mocks.capture.mockResolvedValue(
    Response.json({ status: "accepted" }, { status: HTTP_STATUS.accepted })
  );
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable max-statements, no-undefined, unicorn/no-null -- Keep the ordered auth, origin and ownership checks in one scenario; null and undefined model distinct absent SDK results. */
it("requires authentication, same origin and bound ownership before native access", async () => {
  mocks.principal.mockResolvedValueOnce(null);
  const resolvedResult1 = await POST(request(), context);
  expect(resolvedResult1.status).toBe(HTTP_STATUS.unauthorized);
  const resolvedResult2 = await POST(
    request("https://foreign.invalid"),
    context
  );
  expect(resolvedResult2.status).toBe(HTTP_STATUS.forbidden);
  expect(mocks.source).not.toHaveBeenCalled();
  mocks.source.mockResolvedValueOnce(undefined);
  const resolvedResult3 = await POST(request(), context);
  expect(resolvedResult3.status).toBe(HTTP_STATUS.notFound);
  expect(mocks.source).toHaveBeenCalledWith("owner", id);
  expect(mocks.capture).not.toHaveBeenCalled();
});
/* oxlint-enable max-statements, no-undefined, unicorn/no-null */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-undefined -- The missing origin/body argument exercises the request helper's optional-argument contract. */
it("rejects malformed coordinates before looking up the source", async () => {
  const resolvedResult4 = await POST(
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    request(undefined, { ...input, beforeTurnId: "turn_-1" }),
    context
  );
  expect(resolvedResult4.status).toBe(HTTP_STATUS.badRequest);
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.capture).not.toHaveBeenCalled();
});
/* oxlint-enable no-undefined */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("returns readiness only after the matching immutable checkpoint is available", async () => {
  const response = await POST(request(), context);
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({
    conversationId: id,
    ready: true,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...input,
  });
  const [[ownerId, checkpointPath, capturedRequest]] = mocks.capture.mock.calls;
  expect([ownerId, checkpointPath]).toEqual([
    "owner",
    "/eve/chat/v1/session/native-source/checkpoint",
  ]);
  expect(JSON.parse(capturedRequest.body)).toEqual(input);
  expect(mocks.ready).toHaveBeenCalledWith(
    "owner",
    "native-source",
    input.beforeTurnId,
    input.checkpointId
  );
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("keeps uncertain capture retryable using the exact same coordinates", async () => {
  mocks.ready.mockRejectedValueOnce(new Error("pending"));
  const resolvedResult5 = await POST(request(), context);
  expect(resolvedResult5.status).toBe(HTTP_STATUS.conflict);
  const resolvedResult6 = await POST(request(), context);
  expect(resolvedResult6.status).toBe(HTTP_STATUS.ok);
  expect(
    mocks.capture.mock.calls.map((call: CaptureCall) => {
      const [ownerId, checkpointPath, capturedRequest] = call;
      expect(ownerId).toBe("owner");
      expect(checkpointPath).toBe(
        "/eve/chat/v1/session/native-source/checkpoint"
      );
      const parsedRequest: unknown = JSON.parse(capturedRequest.body);
      return parsedRequest;
    })
  ).toEqual([input, input]);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("recovers an existing receipt without sending another native command", async () => {
  mocks.read.mockResolvedValue(true);
  const resolvedResult7 = await POST(request(), context);
  expect(resolvedResult7.status).toBe(HTTP_STATUS.ok);
  expect(mocks.capture).not.toHaveBeenCalled();
  expect(mocks.ready).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([   { stage: "read", target: () => mocks.read },   { stage: "ready", target: () => mocks.rea's awaited sequencing and rejected-Promise behavior. */

it.each([
  { stage: "read", target: (): typeof mocks.read => mocks.read },
  { stage: "ready", target: (): typeof mocks.read => mocks.ready },
])(
  "returns exact durable rejection coordinates from $stage",
  async ({
    stage,
    target,
  }: {
    readonly stage: string;
    readonly target: () => typeof mocks.read;
  }) => {
    const { CheckpointRejectedError } =
      await import("@/lib/eve/checkpoint-rejection");
    target().mockRejectedValueOnce(
      new CheckpointRejectedError("source_advanced")
    );
    const response = await POST(request(), context);
    expect(response.status).toBe(HTTP_STATUS.conflict);
    expect(await response.json()).toMatchObject({
      checkpointRejected: true,
      conversationId: id,
      reason: "source_advanced",
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
    });
    if (stage === "read") {
      expect(mocks.capture).not.toHaveBeenCalled();
    }
  }
);
/* oxlint-enable oxc/no-async-await */
