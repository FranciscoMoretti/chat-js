import { describe, expect, it } from "vitest";
import {
  moveRejectedProjectCreation,
  prepareCreation,
  readCreation,
} from "./pending-create";

/* oxlint-disable unicorn/no-null -- Storage.getItem returns null for a missing key. */
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-lines-per-function, no-undefined --
 * max-lines-per-function (#510): describe("rejected project draft recovery") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): describe("rejected project draft recovery") uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
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
/* oxlint-enable max-lines-per-function, no-undefined */
