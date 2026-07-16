import { describe, expect, test } from "bun:test";
import type { UIMessage } from "ai";
import { MessageTree, ROOT_PARENT_ID } from "../src/message-tree";

function message(id: string, role: UIMessage["role"] = "user"): UIMessage {
	return { id, parts: [{ text: id, type: "text" }], role };
}

describe("MessageTree", () => {
	test("derives the selected path without deleting sibling branches", () => {
		const tree = new MessageTree({
			messages: [message("u1"), message("a1", "assistant")],
		});
		tree.upsertMessage(message("u2"), "a1");
		tree.upsertMessage(message("a2", "assistant"), "u2");
		tree.upsertMessage(message("a3", "assistant"), "u2");

		tree.setCursor("a2");

		expect(tree.getPath().map(({ id }) => id)).toEqual([
			"u1",
			"a1",
			"u2",
			"a2",
		]);
		expect(tree.getSiblings("a2").map(({ id }) => id)).toEqual(["a2", "a3"]);
		expect(tree.getSnapshot().messagesById.a3?.id).toBe("a3");
	});

	test("reconciles a selected path without deleting hidden descendants", () => {
		const tree = new MessageTree({
			messages: [message("u1"), message("a1", "assistant")],
		});
		tree.upsertMessage(message("u2"), "a1");
		tree.upsertMessage(message("a2", "assistant"), "u2");

		tree.reconcilePath([
			message("u1"),
			message("a1", "assistant"),
			message("u3"),
		]);

		expect(tree.getPath().map(({ id }) => id)).toEqual(["u1", "a1", "u3"]);
		expect(tree.getSnapshot().messagesById.a2?.id).toBe("a2");
	});

	test("validates a path before changing existing nodes", () => {
		const tree = new MessageTree({
			messages: [message("u1"), message("a1", "assistant")],
		});
		tree.upsertMessage(message("u2"), "a1");

		expect(() => tree.reconcilePath([message("u1"), message("u2")])).toThrow(
			"Cannot move message u2",
		);
		expect(tree.getParentId("u2")).toBe("a1");
	});

	test("rejects missing parents and cycles", () => {
		const tree = new MessageTree({ messages: [message("u1")] });

		expect(() => tree.upsertMessage(message("u2"), "missing")).toThrow(
			"Unknown parent message missing",
		);
		expect(() => tree.upsertMessage(message("u1"), "u1")).toThrow(
			"Cannot create a cycle involving u1",
		);
	});

	test("only removes leaves and moves the selected cursor to the parent", () => {
		const tree = new MessageTree({
			messages: [message("u1"), message("a1", "assistant")],
		});

		expect(() => tree.removeLeaf("u1")).toThrow(
			"Cannot remove non-leaf message u1",
		);
		tree.removeLeaf("a1");

		expect(tree.cursorId).toBe("u1");
		expect(tree.getSnapshot().messagesById.a1).toBeUndefined();
	});

	test("round-trips a serializable snapshot", () => {
		const tree = new MessageTree({
			messages: [message("u1"), message("a1", "assistant")],
		});
		const restored = new MessageTree({ snapshot: tree.getSnapshot() });

		expect(restored.getSnapshot()).toEqual(tree.getSnapshot());
		expect(restored.getSnapshot().childrenByParentId[ROOT_PARENT_ID]).toEqual([
			"u1",
		]);
	});
});
