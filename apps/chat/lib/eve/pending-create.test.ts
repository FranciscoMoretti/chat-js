import { describe, expect, it } from "vitest";
import {
  hasPendingCreation,
  moveRejectedContextCreation,
  prepareCreation,
  readCreation,
  readCreationFollowUp,
  saveCreationFollowUp,
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
    saveCreationFollowUp(storage, "owner", "And next month too", { context });
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
    expect(readCreationFollowUp(storage, "owner")).toBe("And next month too");
    expect(readCreationFollowUp(storage, "owner", { context })).toBe("");
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

  it("preserves the project request when New Chat has a standalone draft", () => {
    const storage = storageFixture();
    const projectId = crypto.randomUUID();
    const context = { key: `project:${projectId}`, label: "project" };
    const scope = { context };
    const original = prepareCreation(
      storage,
      "owner",
      "Project message",
      undefined,
      scope,
      undefined,
      { projectId }
    );
    saveCreationFollowUp(storage, "owner", "Project follow-up", scope);
    saveCreationFollowUp(storage, "owner", "Unrelated New Chat draft");
    expect(() =>
      moveRejectedContextCreation(
        storage,
        "owner",
        context,
        original.operationId
      )
    ).toThrow("Send or clear the draft");
    expect(readCreationFollowUp(storage, "owner")).toBe(
      "Unrelated New Chat draft"
    );
    expect(readCreationFollowUp(storage, "owner", scope)).toBe(
      "Project follow-up"
    );
    expect(readCreation(storage, "owner", scope)).toEqual(original);
    expect(readCreation(storage, "owner")).toBeUndefined();
  });
});

it("keeps owner-scoped unresolved forks discoverable, including damaged drafts", () => {
  const storage = storageFixture();
  const branchId = crypto.randomUUID();
  expect(hasPendingCreation(storage, "owner", { branchId })).toBe(false);
  prepareCreation(storage, "owner", "edit", undefined, { branchId });
  expect(hasPendingCreation(storage, "owner", { branchId })).toBe(true);
  expect(hasPendingCreation(storage, "other", { branchId })).toBe(false);
  storage.setItem(`chatjs.eve.pending:owner:fork:${branchId}`, "damaged");
  expect(hasPendingCreation(storage, "owner", { branchId })).toBe(true);
});
