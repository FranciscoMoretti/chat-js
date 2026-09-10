import { describe, expect, it } from "vitest";
import { resolveForkSource } from "./fork-source";
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
    expect(readCreation(storage, "owner", conversationId)).toEqual(edit);
    expect(
      prepareCreation(storage, "owner", "changed", "other", {
        ...context,
        fork: { ...context.fork, beforeTurnId: "turn_0" },
      })
    ).toEqual(edit);
    expect(readCreation(storage, "owner")).toEqual(fresh);
    expect(readCreation(storage, "other", conversationId)).toBeUndefined();
    finishCreation(storage, "owner", conversationId);
    expect(readCreation(storage, "owner", conversationId)).toBeUndefined();
    expect(readCreation(storage, "owner")).toEqual(fresh);
  });
});
