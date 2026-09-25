import { describe, expect, it } from "vitest";

import {
  moveRejectedProjectCreation,
  prepareCreation,
  readCreation,
} from "./pending-create";

const storageFixture = () => {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
};

describe("rejected project draft recovery", () => {
  it("moves the exact model and message to a fresh ordinary operation", () => {
    const storage = storageFixture();
    const projectId = crypto.randomUUID();
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
      { projectId }
    );
    const next = moveRejectedProjectCreation(
      storage,
      "owner",
      projectId,
      original.operationId
    );
    expect(next).toMatchObject({
      message: original.message,
      modelId: original.modelId,
    });
    expect(next.operationId).not.toBe(original.operationId);
    expect(next.projectId).toBeUndefined();
    expect(readCreation(storage, "owner")).toEqual(next);
    expect(readCreation(storage, "owner", { projectId })).toBeUndefined();
  });
  it("preserves both requests if another root draft exists", () => {
    const storage = storageFixture();
    const projectId = crypto.randomUUID();
    const ordinary = prepareCreation(storage, "owner", "Other message");
    const original = prepareCreation(
      storage,
      "owner",
      "Project message",
      undefined,
      { projectId }
    );
    expect(() =>
      moveRejectedProjectCreation(
        storage,
        "owner",
        projectId,
        original.operationId
      )
    ).toThrow("Finish the saved request");
    expect(readCreation(storage, "owner")).toEqual(ordinary);
    expect(readCreation(storage, "owner", { projectId })).toEqual(original);
    expect(() =>
      moveRejectedProjectCreation(
        storage,
        "other-owner",
        projectId,
        original.operationId
      )
    ).toThrow("saved request changed");
  });
});
