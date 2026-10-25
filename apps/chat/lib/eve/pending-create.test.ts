import { describe, expect, it } from "vitest";
import {
  hasPendingCreation,
  moveRejectedContextCreation,
  prepareCreation,
  readCreation,
} from "./pending-create";

const storageFixture = (): Pick<
  Storage,
  "getItem" | "removeItem" | "setItem"
> => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string): void => {
      entries.delete(key);
    },
    setItem: (key: string, value: string): void => {
      entries.set(key, value);
    },
  };
};

describe("rejected project draft recovery", () => {
  it("moves the exact model and message to a fresh ordinary operation", () => {
    const storage = storageFixture();
    const projectId = crypto.randomUUID();
    const context = {
      key: `project:${projectId}`,
      label: "project",
    };
    const original = prepareCreation(
      storage,
      "owner",
      [
        { text: "Keep my message", type: "text" },
        {
          data: "/api/files/abcdefghijklmnopqrstuvwx.png",
          filename: "square.png",
          mediaType: "image/png",
          type: "file",
        },
      ],
      "chosen-model",
      { context },
      undefined,
      { projectId }
    );
    const next = moveRejectedContextCreation(
      storage,
      "owner",
      context,
      original.operationId
    );
    expect(next).toMatchObject({
      message: original.message,
      modelId: original.modelId,
    });
    expect(next.operationId).not.toBe(original.operationId);
    expect(next.projectId).toBeUndefined();
    expect(readCreation(storage, "owner")).toEqual(next);
    expect(readCreation(storage, "owner", { context })).toBeUndefined();
  });
  it("preserves both requests if another root draft exists", () => {
    const storage = storageFixture();
    const projectId = crypto.randomUUID();
    const context = {
      key: `project:${projectId}`,
      label: "project",
    };
    const ordinary = prepareCreation(storage, "owner", "Other message");
    const original = prepareCreation(
      storage,
      "owner",
      "Project message",
      undefined,
      { context },
      undefined,
      { projectId }
    );
    expect(() =>
      moveRejectedContextCreation(
        storage,
        "owner",
        context,
        original.operationId
      )
    ).toThrow("Finish the saved request");
    expect(readCreation(storage, "owner")).toEqual(ordinary);
    expect(readCreation(storage, "owner", { context })).toEqual(original);
    expect(() =>
      moveRejectedContextCreation(
        storage,
        "other-owner",
        context,
        original.operationId
      )
    ).toThrow("saved request changed");
  });
});

it("keeps owner-scoped unresolved forks discoverable, including damaged drafts", () => {
  const storage = storageFixture();
  const conversationId = crypto.randomUUID();
  expect(hasPendingCreation(storage, "owner", { conversationId })).toBe(false);
  prepareCreation(storage, "owner", "edit", undefined, { conversationId });
  expect(hasPendingCreation(storage, "owner", { conversationId })).toBe(true);
  expect(hasPendingCreation(storage, "other", { conversationId })).toBe(false);
  storage.setItem(`chatjs.eve.pending:owner:fork:${conversationId}`, "damaged");
  expect(hasPendingCreation(storage, "owner", { conversationId })).toBe(true);
});
