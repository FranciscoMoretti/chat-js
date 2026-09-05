import { createThreadStateSnapshot } from "@chat-js/thread";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/lib/ai/types";
import {
  buildTreeSnapshotFromMessages,
  getParallelResponseForSlot,
} from "./thread-utils";

function message({
  id,
  parentMessageId,
  parallelIndex = null,
  role,
}: {
  id: string;
  parentMessageId: string | null;
  parallelIndex?: number | null;
  role: "assistant" | "user";
}): ChatMessage {
  return {
    id,
    metadata: {
      activeStreamId: null,
      createdAt: new Date(parallelIndex ?? 0),
      parentMessageId,
      parallelGroupId: parallelIndex === null ? null : "group-1",
      parallelIndex,
      selectedModel: "openai/gpt-5-nano",
    },
    parts: [{ text: id, type: "text" }],
    role,
  };
}

describe("buildTreeSnapshotFromMessages", () => {
  it("initializes the selected path without dropping sibling branches", () => {
    const root = message({
      id: "root",
      parentMessageId: null,
      role: "user",
    });
    const first = message({
      id: "first",
      parentMessageId: root.id,
      parallelIndex: 0,
      role: "assistant",
    });
    const second = message({
      id: "second",
      parentMessageId: root.id,
      parallelIndex: 1,
      role: "assistant",
    });

    const tree = buildTreeSnapshotFromMessages(
      [second, root, first],
      second.id
    );
    const snapshot = createThreadStateSnapshot({ initialTree: tree });

    expect(tree.nodes.map(({ message: node }) => node.id)).toEqual([
      root.id,
      first.id,
      second.id,
    ]);
    expect(snapshot.messages.map(({ id }) => id)).toEqual([root.id, second.id]);
    expect(snapshot.childrenByParentId[root.id]).toEqual([first.id, second.id]);
  });

  it("preserves present parent edges when an ancestor is missing", () => {
    const parent = message({
      id: "parent",
      parentMessageId: "missing",
      role: "user",
    });
    const child = message({
      id: "child",
      parentMessageId: parent.id,
      role: "assistant",
    });

    const tree = buildTreeSnapshotFromMessages([child, parent], child.id);
    const snapshot = createThreadStateSnapshot({ initialTree: tree });

    expect(
      tree.nodes.map(({ message: node, parentId }) => [node.id, parentId])
    ).toEqual([
      [parent.id, null],
      [child.id, parent.id],
    ]);
    expect(snapshot.messages.map(({ id }) => id)).toEqual([
      parent.id,
      child.id,
    ]);
  });
});

describe("getParallelResponseForSlot", () => {
  it("keeps the selected version of a parallel response slot", () => {
    const root = message({ id: "root", parentMessageId: null, role: "user" });
    const original = message({
      id: "original",
      parallelIndex: 1,
      parentMessageId: root.id,
      role: "assistant",
    });
    const retry = message({
      id: "retry",
      parallelIndex: 1,
      parentMessageId: root.id,
      role: "assistant",
    });

    expect(getParallelResponseForSlot([original, retry], 1, original.id)).toBe(
      original
    );
  });

  it("uses the latest version when another parallel slot is selected", () => {
    const root = message({ id: "root", parentMessageId: null, role: "user" });
    const original = message({
      id: "original",
      parallelIndex: 1,
      parentMessageId: root.id,
      role: "assistant",
    });
    const retry = message({
      id: "retry",
      parallelIndex: 1,
      parentMessageId: root.id,
      role: "assistant",
    });

    expect(getParallelResponseForSlot([original, retry], 1, null)).toBe(retry);
  });
});
