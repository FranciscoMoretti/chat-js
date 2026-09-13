import { describe, expect, it } from "vitest";

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
          method: "POST",
          headers: { origin: "https://evil.test" },
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
        inputResponses: [{ requestId: "req", optionId: "allow" }],
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
});

describe("Eve command recovery", () => {
  it("validates before retaining intent and isolates pending intents by account", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
      removeItem: (key: string) => {
        data.delete(key);
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
    let replayed = 0;
    await expect(
      sendCommand(
        () => Promise.resolve(),
        () => {
          replayed += 1;
          return Promise.resolve();
        },
        true,
        () => new Error("failed")
      )
    ).rejects.toThrow("failed");
    expect(replayed).toBe(0);
    await sendCommand(
      () => Promise.resolve(),
      () => {
        replayed += 1;
        return Promise.resolve();
      },
      true,
      () => undefined
    );
    expect(replayed).toBe(1);
  });
});

it("waits for authoritative acceptance after cancellation without submitting twice", async () => {
  let submissions = 0;
  let snapshots = 0;
  await sendCommand(
    () => {
      submissions += 1;
      return Promise.resolve();
    },
    () => {
      snapshots += 1;
      return Promise.resolve();
    },
    true,
    () => undefined,
    () => snapshots >= 2
  );
  expect(submissions).toBe(1);
  expect(snapshots).toBe(2);
});

it("accepts conversation-based forks and rejects raw native identities or invalid turns", () => {
  const input = { operationId: crypto.randomUUID(), message: "replacement" };
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { conversationId: crypto.randomUUID(), beforeTurnId: "turn_1" },
    }).success
  ).toBe(true);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { sessionId: "native-session", beforeTurnId: "turn_1" },
    }).success
  ).toBe(false);
  expect(
    createConversationInput.safeParse({
      ...input,
      fork: { conversationId: crypto.randomUUID(), beforeTurnId: "turn_-1" },
    }).success
  ).toBe(false);
});

it("allows a project for new conversations while forks inherit their existing project", () => {
  const input = {
    operationId: crypto.randomUUID(),
    message: "Project conversation",
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
      fork: { conversationId: crypto.randomUUID(), beforeTurnId: "turn_0" },
    }).success
  ).toBe(false);
});

it("accepts exactly one canonical imported fork boundary", () => {
  const input = {
    operationId: crypto.randomUUID(),
    message: "Replacement question",
    fork: {
      conversationId: crypto.randomUUID(),
      beforeMessageId: "seed_message_2",
    },
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
