import { beforeEach, expect, it, vi } from "vitest";

import { POST } from "./route";

const HTTP_STATUS = {
  badRequest: 400,
  forbidden: 403,
  ok: 200,
  serviceUnavailable: 503,
  unauthorized: 401,
};

const mocks = vi.hoisted(() => ({
  creation: vi.fn(),
  save: vi.fn(),
  session: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: mocks.session } } }));
vi.mock("@/lib/db/eve-queries", () => ({ getEveCreation: mocks.creation }));
vi.mock("@/lib/eve/save-copy-operation", () => ({
  saveEveCopyOperation: mocks.save,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
const input = {
  modelId: "google/gemini-2.5-flash-lite",
  operationId: "d6b4be57-c67c-4231-b0ac-5a82a873c20a",
  sourceConversationId: "9d86c472-7b38-458d-9811-55078f3b04dc",
};
const request = (
  body: unknown = input,
  origin = "http://localhost:3790"
): Request =>
  new Request("http://localhost:3790/api/agent-conversation-copies", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", origin },
    method: "POST",
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  mocks.save.mockResolvedValue({ id: input.operationId, sessionId: "native" });
});
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable unicorn/no-null -- The auth mock uses null to represent an absent session at this security boundary. */
it("requires login and same origin before copy work", async () => {
  mocks.session.mockResolvedValue(null);
  const resolvedResult2 = await POST(request());
  expect(resolvedResult2.status).toBe(HTTP_STATUS.unauthorized);
  mocks.session.mockResolvedValue({ user: { id: "owner" } });
  const resolvedResult3 = await POST(request(input, "https://foreign.example"));
  expect(resolvedResult3.status).toBe(HTTP_STATUS.forbidden);
  expect(mocks.save).not.toHaveBeenCalled();
});
/* oxlint-enable unicorn/no-null */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("rejects browser seeds, execution controls and oversized bodies", async () => {
  for (const body of [
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...input, seed: { messages: [] } },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...input, fork: {} },
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    { ...input, sourceSessionId: "private" },
    // oxlint-disable-next-line no-magic-numbers, oxc/no-rest-spread-properties -- The model identifier must be clearly oversized for validation; its exact fixture length is immaterial. Keep the input own-key composition and positional override order.
    { ...input, modelId: "x".repeat(3000) },
  ]) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Wait for each bounded stream read, readiness attempt, or shared fixture before continuing.
    const resolvedResult4 = await POST(request(body));
    expect(resolvedResult4.status).toBe(HTTP_STATUS.badRequest);
  }
  expect(mocks.save).not.toHaveBeenCalled();
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("canonicalizes operation coordinates and returns only the owned binding", async () => {
  const response = await POST(
    request({
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing input own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...input,
      operationId: input.operationId.toUpperCase(),
      sourceConversationId: input.sourceConversationId.toUpperCase(),
    })
  );
  expect(response.status).toBe(HTTP_STATUS.ok);
  expect(mocks.save).toHaveBeenCalledWith(
    "owner",
    input,
    "http://localhost:3790"
  );
  expect(response.headers.get("cache-control")).toBe("no-store");
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("retains ambiguous operations and exposes only an owned recovery location", async () => {
  mocks.save.mockRejectedValue(new Error("sensitive native failure"));
  mocks.creation.mockResolvedValue({
    creationKind: "copy",
    id: input.operationId,
    state: "uncertain",
  });
  const response = await POST(request());
  expect(response.status).toBe(HTTP_STATUS.serviceUnavailable);
  const body: unknown = await response.json();
  expect(body).toMatchObject({
    conversationId: input.operationId,
    retryable: true,
  });
  expect(JSON.stringify(body)).not.toContain("sensitive");
  expect(mocks.creation).toHaveBeenCalledWith("owner", input.operationId);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it's awaited sequencing and rejected-Promise behavior. */

it("allows discarding the browser request only for a known unavailable operation", async () => {
  mocks.save.mockRejectedValue(new Error("rejected"));
  mocks.creation.mockResolvedValue({
    creationKind: "copy",
    id: input.operationId,
    state: "deleted",
  });
  const resolvedResult5 = await POST(request());
  expect(await resolvedResult5.json()).toMatchObject({
    retryable: false,
  });
  mocks.creation.mockRejectedValue(new Error("database unavailable"));
  const resolvedResult6 = await POST(request());
  expect(await resolvedResult6.json()).toMatchObject({
    retryable: true,
  });
});
/* oxlint-enable oxc/no-async-await */
