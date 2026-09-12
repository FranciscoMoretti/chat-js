import { describe, expect, it } from "vitest";
import { eveUserForkBoundary, resolveForkSource } from "./fork-source";
import {
  finishCreation,
  prepareCreation,
  readCreation,
} from "./pending-create";

describe("fork ancestry and recovery", () => {
  const branches = [
    { id: "root", parentConversationId: null, forkTurnId: null },
    { id: "child", parentConversationId: "root", forkTurnId: "turn_2" },
    { id: "nested", parentConversationId: "child", forkTurnId: "turn_4" },
  ];
  it("finds the checkpoint owner for inherited turns and keeps a replacement turn local", () => {
    expect(resolveForkSource("nested", "turn_1", branches).conversationId).toBe(
      "root"
    );
    expect(resolveForkSource("nested", "turn_2", branches).conversationId).toBe(
      "child"
    );
    expect(resolveForkSource("nested", "turn_4", branches).conversationId).toBe(
      "nested"
    );
    expect(() =>
      resolveForkSource("nested", "turn_1", branches.slice(1))
    ).toThrow("unavailable");
  });
  it("preserves an immutable fork across reload independently of a new-chat draft", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    };
    const conversationId = crypto.randomUUID();
    const context = {
      conversationId,
      fork: { conversationId: crypto.randomUUID(), beforeTurnId: "turn_2" },
    };
    const fresh = prepareCreation(storage, "owner", "new chat");
    const edit = prepareCreation(
      storage,
      "owner",
      "replacement",
      "model",
      context
    );
    expect(readCreation(storage, "owner", { conversationId })).toEqual(edit);
    expect(
      prepareCreation(storage, "owner", "changed", "other", {
        ...context,
        fork: { ...context.fork, beforeTurnId: "turn_0" },
      })
    ).toEqual(edit);
    expect(readCreation(storage, "owner")).toEqual(fresh);
    expect(readCreation(storage, "other", { conversationId })).toBeUndefined();
    finishCreation(storage, "owner", { conversationId });
    expect(readCreation(storage, "owner", { conversationId })).toBeUndefined();
    expect(readCreation(storage, "owner")).toEqual(fresh);
  });
});

it("isolates project creation recovery from ordinary chats, other projects, and other owners", () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
  const scope = { projectId: crypto.randomUUID() };
  const other = { projectId: crypto.randomUUID() };
  const ordinary = prepareCreation(storage, "owner", "Ordinary");
  const project = prepareCreation(
    storage,
    "owner",
    "Project draft",
    "model",
    scope
  );
  expect(project.projectId).toBe(scope.projectId);
  expect(readCreation(storage, "owner", scope)).toEqual(project);
  expect(
    prepareCreation(storage, "owner", "Edited", "other-model", scope)
  ).toEqual(project);
  expect(readCreation(storage, "owner", other)).toBeUndefined();
  expect(readCreation(storage, "other", scope)).toBeUndefined();
  finishCreation(storage, "owner", scope);
  expect(readCreation(storage, "owner", scope)).toBeUndefined();
  expect(readCreation(storage, "owner")).toEqual(ordinary);
});

it("keeps imported boundaries local to the retained seed in every descendant", () => {
  const branches = [
    { id: "copy", parentConversationId: null, forkTurnId: null },
    { id: "child", parentConversationId: "copy", forkTurnId: "turn_1" },
  ];
  expect(resolveForkSource("child", "seed_message_2", branches)).toEqual({
    conversationId: "child",
    beforeMessageId: "seed_message_2",
  });
  for (const boundary of [
    "seed_message_02",
    "seed_message_10000",
    "message_2",
  ]) {
    expect(() => resolveForkSource("child", boundary, branches)).toThrow(
      "unavailable"
    );
  }
  expect(() =>
    resolveForkSource("missing", "seed_message_2", branches)
  ).toThrow("unavailable");
});

it("enables only durable user-message boundaries", () => {
  expect(eveUserForkBoundary({ id: "seed_message_2", role: "user" })).toBe(
    "seed_message_2"
  );
  expect(
    eveUserForkBoundary({
      id: "native",
      role: "user",
      metadata: { turnId: "turn_0" },
    })
  ).toBe("turn_0");
  expect(
    eveUserForkBoundary({ id: "seed_message_2", role: "assistant" })
  ).toBeUndefined();
  expect(
    eveUserForkBoundary({
      id: "seed_message_2",
      role: "user",
      metadata: { optimistic: true },
    })
  ).toBeUndefined();
  expect(eveUserForkBoundary({ id: "pending", role: "user" })).toBeUndefined();
});
