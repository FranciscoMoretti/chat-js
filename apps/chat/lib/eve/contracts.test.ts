import { describe, expect, it, vi } from "vitest";
import { createConversationInput } from "./contracts";
import { prepareCreation } from "./pending-create";
import {
  parseSessionRequest,
  safeStreamQuery,
  sameOrigin,
} from "./request-policy";
import { sendCommand } from "./send-command";

describe("Eve request policy", () => {
  it("denies raw create, control bypasses and cross-origin mutations", () => {
    for (const path of [
      "/eve/v1/session",
      "/eve/v1/session/a/reset",
      "/eve/v1/session/a/compact",
      "/eve/v1/session/a/clear",
      "/eve/v1/session/a/subagents",
      "/eve/v1/session/a%2fb",
    ]) {
      expect(parseSessionRequest(path, "POST")).toBeNull();
    }
    expect(
      parseSessionRequest("/eve/v1/session/a/stream", "GET")?.sessionId
    ).toBe("a");
    expect(parseSessionRequest("/eve/v1/session/a/cancel", "GET")).toBeNull();
    expect(
      sameOrigin(
        new Request("http://localhost/api", {
          headers: { origin: "https://evil.test" },
          method: "POST",
        }),
        "http://localhost"
      )
    ).toBe(false);
    expect(
      sameOrigin(
        new Request("http://localhost/api", { method: "POST" }),
        "http://localhost"
      )
    ).toBe(false);
  });
  it("accepts native active-turn cancellation but rejects malformed or expanded controls", () => {
    const policy = parseSessionRequest("/eve/v1/session/a/cancel", "POST");
    for (const input of [{}, { turnId: "turn-1" }]) {
      expect(policy?.schema.safeParse(input).success).toBe(true);
    }
    for (const input of [
      { turnId: "" },
      { turnId: null },
      { turnId: 1 },
      { tasks: true },
      { owner: "other" },
    ]) {
      expect(policy?.schema.safeParse(input).success).toBe(false);
    }
  });
  it("rejects malformed native messages and stream cursors", () => {
    const policy = parseSessionRequest("/eve/v1/session/a", "POST");
    expect(
      policy?.schema.safeParse({ message: "hello", owner: "other" }).success
    ).toBe(false);
    expect(policy?.schema.safeParse({ message: "  " }).success).toBe(false);
    expect(
      policy?.schema.safeParse({
        inputResponses: [{ optionId: "allow", requestId: "req" }],
      }).success
    ).toBe(true);
    for (const query of [
      "startIndex=-1",
      "follow=123",
      "foo=true",
      "startIndex=1&startIndex=2",
    ]) {
      expect(safeStreamQuery(new URLSearchParams(query))).toBeNull();
    }
    expect(
      safeStreamQuery(
        new URLSearchParams("startIndex=0&includeTailIndex=1")
      )?.get("startIndex")
    ).toBe("0");
  });
  it("preserves native stream control negotiation while rejecting unsupported queries", () => {
    for (const query of [
      "streamControlVersion=1&includeTailIndex=1",
      "startIndex=12&streamControlVersion=1&includeTailIndex=1",
    ]) {
      expect(safeStreamQuery(new URLSearchParams(query))?.toString()).toBe(
        query
      );
    }
    for (const query of [
      "streamControlVersion=2",
      "streamControlVersion=",
      "streamControlVersion=1&streamControlVersion=1",
      "streamControlVersion=1&foo=true",
    ]) {
      expect(safeStreamQuery(new URLSearchParams(query))).toBeNull();
    }
  });
});

describe("Eve command recovery", () => {
  it("validates before retaining intent and isolates pending intents by account", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string): string | null => data.get(key) ?? null,
      removeItem: (key: string): void => {
        data.delete(key);
      },
      setItem: (key: string, value: string): void => {
        data.set(key, value);
      },
    };
    expect(() => prepareCreation(storage, "alice", " ")).toThrow();
    expect(data.size).toBe(0);
    const first = prepareCreation(
      storage,
      "alice",
      "hello",
      "openai/gpt-4.1-mini"
    );
    expect(prepareCreation(storage, "alice", "edited", "other-model")).toEqual(
      first
    );
    expect(prepareCreation(storage, "bob", "other").message).toBe("other");
  });
  it("surfaces callback-only failures and catches up after cancellation", async () => {
    const resume = vi.fn<() => Promise<void>>().mockResolvedValue();
    await expect(
      sendCommand(
        vi.fn<() => Promise<void>>().mockResolvedValue(),
        resume,
        true,
        () => new Error("failed")
      )
    ).rejects.toThrow("failed");
    expect(resume).toHaveBeenCalledTimes(0);
    await sendCommand(
      vi.fn<() => Promise<void>>().mockResolvedValue(),
      resume,
      true,
      () => {
        // This test verifies replay without an additional side effect.
      }
    );
    expect(resume).toHaveBeenCalledTimes(1);
  });
});

it("waits for authoritative acceptance after cancellation without submitting twice", async () => {
  const send = vi.fn<() => Promise<void>>().mockResolvedValue();
  const resume = vi.fn<() => Promise<void>>().mockResolvedValue();
  await sendCommand(
    send,
    resume,
    true,
    () => {
      // This test verifies cancellation without an additional side effect.
    },
    () => resume.mock.calls.length >= 2
  );
  expect(send).toHaveBeenCalledTimes(1);
  expect(resume).toHaveBeenCalledTimes(2);
});

it("accepts current conversation copies and rejects native identities or historical turns", () => {
  const input = { message: "replacement", operationId: crypto.randomUUID() };
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { conversationId: crypto.randomUUID() },
    }).success
  ).toBe(true);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_1", sessionId: "native-session" },
    }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_-1", conversationId: crypto.randomUUID() },
    }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({ ...input, forkKind: "edit" }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { conversationId: crypto.randomUUID() },
      forkKind: "regenerate",
    }).success
  ).toBe(true);
});

it("allows a project for new conversations while forks inherit their existing project", () => {
  const input = {
    message: "Project conversation",
    operationId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
  };
  expect(createConversationInput.safeParse(input).success).toBe(true);
  expect(
    createConversationInput.safeParse({ ...input, projectId: "invalid" })
      .success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { beforeTurnId: "turn_0", conversationId: crypto.randomUUID() },
    }).success
  ).toBe(false);
});

it("rejects all historical copy boundaries", () => {
  const input = {
    fork: {
      conversationId: crypto.randomUUID(),
    },
    message: "Replacement question",
    operationId: crypto.randomUUID(),
  };
  expect(createConversationInput.parse(input)).toEqual(input);
  for (const fork of [
    { ...input.fork, beforeTurnId: "turn_0" },
    { ...input.fork, checkpointId: crypto.randomUUID() },
    { ...input.fork, beforeMessageId: "seed_message_02" },
    { ...input.fork, beforeMessageId: "seed_message_10000" },
    { ...input.fork, beforeMessageId: "message_2" },
  ]) {
    expect(createConversationInput.safeParse({ ...input, fork }).success).toBe(
      false
    );
  }
});
