import { describe, expect, it } from "vitest";
import {
  moveRejectedProjectCreation,
  prepareCreation,
  readCreation,
} from "./pending-create";

function storageFixture() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
  };
}

describe("rejected project draft recovery", () => {
  it("moves the exact model and message to a fresh ordinary operation", () => {
    const storage = storageFixture();
    const projectId = crypto.randomUUID();
    const original = prepareCreation(
      storage,
      "owner",
      [
        { type: "text", text: "Keep my message" },
        {
          type: "file",
          data: "/api/files/content?key=abcdefghijklmnopqrstuvwx.png",
          filename: "square.png",
          mediaType: "image/png",
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
