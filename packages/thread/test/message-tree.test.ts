import { describe, expect, test } from "bun:test";

import { MessageTree } from "#thread-source/message-tree";

import type { UIMessage } from "ai";

const message = (id: string, role: UIMessage["role"] = "user"): UIMessage => ({
  id,
  parts: [{ text: id, type: "text" }],
  role,
});

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
describe("MessageTree", () => {
  test("derives the selected path without deleting sibling branches", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });
    tree.upsertMessage(message("u2"), "a1");
    tree.upsertMessage(message("a2", "assistant"), "u2");
    tree.upsertMessage(message("a3", "assistant"), "u2");

    tree.setCursor("a2");

    expect(
      tree.getPath().map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["u1", "a1", "u2", "a2"]);
    expect(
      tree
        .getSiblings("a2")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["a2", "a3"]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from tree.getMessage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(tree.getMessage("a3")?.id).toBe("a3");
  });

  test("sets the selected path without deleting hidden descendants", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });
    tree.upsertMessage(message("u2"), "a1");
    tree.upsertMessage(message("a2", "assistant"), "u2");

    tree.setPath([message("u1"), message("a1", "assistant"), message("u3")]);

    expect(
      tree.getPath().map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["u1", "a1", "u3"]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from tree.getMessage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(tree.getMessage("a2")?.id).toBe("a2");
  });

  test("clears the selected path without deleting tree nodes", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });

    tree.setPath([]);

    expect(tree.cursorId).toBeNull();
    expect(tree.getPath()).toEqual([]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from tree.getMessage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(tree.getMessage("a1")?.id).toBe("a1");
  });

  test("updates a path without changing the selected path", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });
    tree.upsertMessage(message("u2"), "a1");
    tree.setCursor("u2");

    tree.updatePath([
      message("u1"),
      message("a1", "assistant"),
      message("u3"),
      message("a3", "assistant"),
    ]);

    expect(tree.cursorId).toBe("u2");
    expect(
      tree.getPath().map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["u1", "a1", "u2"]);
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from tree.getMessage(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    expect(tree.getMessage("a3")?.id).toBe("a3");
  });

  test("validates a path before changing existing nodes", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });
    tree.upsertMessage(message("u2"), "a1");

    expect(() => tree.setPath([message("u1"), message("u2")])).toThrow(
      "Cannot move message u2"
    );
    expect(tree.getParentId("u2")).toBe("a1");
  });

  test("rejects missing parents and cycles", () => {
    const tree = new MessageTree({ messages: [message("u1")] });

    expect(() => tree.upsertMessage(message("u2"), "missing")).toThrow(
      "Unknown parent message missing"
    );
    expect(() => tree.upsertMessage(message("u1"), "u1")).toThrow(
      "Cannot create a cycle involving u1"
    );
  });

  test("allows message IDs that resemble internal root keys", () => {
    const tree = new MessageTree({ messages: [message("__root__")] });
    tree.upsertMessage(message("child"), "__root__");

    expect(tree.getIndexes().rootIds).toEqual(["__root__"]);
    expect(
      tree
        .getChildren("__root__")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["child"]);
    expect(
      tree.getLeaves().map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["child"]);
  });

  test("only removes leaves and moves the selected cursor to the parent", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });

    expect(() => tree.removeLeaf("u1")).toThrow(
      "Cannot remove non-leaf message u1"
    );
    tree.removeLeaf("a1");

    expect(tree.cursorId).toBe("u1");
    expect(tree.getMessage("a1")).toBeUndefined();
  });

  test("inserts a message at an explicit sibling position", () => {
    const tree = new MessageTree({
      messages: [message("u1")],
    });
    tree.upsertMessage(message("a2", "assistant"), "u1", { index: 1 });
    tree.upsertMessage(message("a1", "assistant"), "u1", { index: 0 });

    expect(
      tree
        .getChildren("u1")
        .map(({ id }: Readonly<Pick<UIMessage, "id">>) => id)
    ).toEqual(["a1", "a2"]);
  });

  test("round-trips a serializable snapshot", () => {
    const tree = new MessageTree({
      messages: [message("u1"), message("a1", "assistant")],
    });
    const restored = new MessageTree({ snapshot: tree.getSnapshot() });

    expect(restored.getSnapshot()).toEqual(tree.getSnapshot());
    expect(
      restored
        .getSnapshot()
        .nodes.map(
          ({
            message: nodeMessage,
          }: Readonly<{ message: Readonly<Pick<UIMessage, "id">> }>) =>
            nodeMessage.id
        )
    ).toEqual(["u1", "a1"]);
    expect(restored.getIndexes().rootIds).toEqual(["u1"]);
  });

  test("rejects unordered and duplicate snapshot nodes", () => {
    expect(
      () =>
        new MessageTree({
          snapshot: {
            cursorId: null,
            nodes: [{ message: message("a1"), parentId: "u1" }],
            version: 1,
          },
        })
    ).toThrow("Unknown parent message u1");

    expect(
      () =>
        new MessageTree({
          snapshot: {
            cursorId: null,
            nodes: [
              { message: message("u1"), parentId: null },
              { message: message("u1"), parentId: null },
            ],
            version: 1,
          },
        })
    ).toThrow("Duplicate message id u1 in snapshot");

    expect(
      () =>
        new MessageTree({
          snapshot: {
            cursorId: null,
            nodes: [
              { message: message("a"), parentId: "b" },
              { message: message("b"), parentId: "a" },
            ],
            version: 1,
          },
        })
    ).toThrow("Unknown parent message b");
  });
});
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
