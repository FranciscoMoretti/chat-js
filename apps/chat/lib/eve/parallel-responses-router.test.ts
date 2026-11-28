import { beforeEach, expect, test, vi } from "vitest";
import { router } from "@/chatjs/plugins/parallel-responses/router";

const mocks = vi.hoisted(() => ({
  after: vi.fn<(callback: () => void | Promise<void>) => void>(),
  create: vi.fn(),
  afterCreate: vi.fn(),
  principal: vi.fn(),
}));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/headers", () => ({ headers: () => new Headers() }));
vi.mock("@/lib/auth", () => ({ auth: {} }));
vi.mock("@/lib/eve/principal", () => ({
  resolveEvePrincipal: mocks.principal,
}));
vi.mock("@/lib/env", () => ({ env: { APP_URL: "http://localhost:3790" } }));
vi.mock("@/chatjs/plugins/parallel-responses/response-group", () => ({
  createEveResponseGroup: mocks.create,
}));
vi.mock("@/lib/chat-after-create", () => ({
  runChatAfterCreate: mocks.afterCreate,
}));

const input = {
  message: "Compare",
  modelIds: ["a", "b"],
  operationId: "00000000-0000-4000-8000-000000000001",
};
const caller = (origin = "http://localhost:3790") =>
  router.createCaller({
    request: new Request(
      "http://localhost:3790/api/trpc/parallelResponses.submit",
      { method: "POST", headers: { origin } }
    ),
    user: undefined,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.principal.mockResolvedValue({ kind: "registered", ownerId: "owner" });
  mocks.create.mockResolvedValue({ candidates: [], id: input.operationId });
});

test("requires an authenticated owner and a matching origin before submission", async () => {
  await Promise.all(
    ["", "https://foreign.invalid"].map(async (origin) => {
      await expect(
        caller(origin).parallelResponses.submit(input)
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    })
  );
  mocks.principal.mockResolvedValueOnce(null);
  await expect(caller().parallelResponses.submit(input)).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(mocks.create).not.toHaveBeenCalled();
  await caller().parallelResponses.submit(input);
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith("owner", input);
});

test("rejects invalid input and preserves ambiguous creation as a conflict", async () => {
  await expect(
    caller().parallelResponses.submit({ ...input, modelIds: [] })
  ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.create.mockRejectedValueOnce(new Error("internal failure"));
  await expect(caller().parallelResponses.submit(input)).rejects.toMatchObject({
    code: "CONFLICT",
    message:
      "Response group is unavailable or unresolved. Retain the original request before retrying.",
  });
  expect(mocks.after).not.toHaveBeenCalled();
});
test("schedules one plugin work for an initial comparison chat", async () => {
  mocks.create.mockResolvedValue({
    candidates: [
      {
        branchId: "00000000-0000-4000-8000-000000000002",
        modelId: "a",
        operationId: input.operationId,
        sessionId: "session-a",
        state: "bound",
      },
      {
        branchId: "00000000-0000-4000-8000-000000000003",
        modelId: "b",
        operationId: "00000000-0000-4000-8000-000000000004",
        sessionId: "session-b",
        state: "bound",
      },
    ],
    id: input.operationId,
  });

  await caller().parallelResponses.submit(input);
  expect(mocks.after).toHaveBeenCalledOnce();
  const [[afterResponseCallback]] = mocks.after.mock.calls;
  await afterResponseCallback();
  expect(mocks.afterCreate).toHaveBeenCalledWith({
    branchId: "00000000-0000-4000-8000-000000000002",
    message: "Compare",
    ownerId: "owner",
  });
});

test("does not retitle a forked comparison chat", async () => {
  mocks.create.mockResolvedValue({
    candidates: [
      {
        branchId: "00000000-0000-4000-8000-000000000002",
        modelId: "a",
        operationId: input.operationId,
        sessionId: "session-a",
        state: "bound",
      },
    ],
    id: input.operationId,
  });
  await caller().parallelResponses.submit({
    ...input,
    fork: {
      beforeMessageId: "turn_0",
      branchId: "00000000-0000-4000-8000-000000000005",
    },
    forkKind: "comparison",
  });
  expect(mocks.after).not.toHaveBeenCalled();
});
