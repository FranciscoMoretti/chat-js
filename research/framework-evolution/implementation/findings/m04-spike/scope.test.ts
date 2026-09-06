import { expect, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { createThread } from "../../../../../packages/thread/src/thread";
import {
	bindComposer,
	bindControls,
	createView,
	defineServices,
	draftKey,
	editDraft,
	type Origin,
} from "./scope";

const message = (id: string): UIMessage => ({
	id,
	role: "assistant",
	parts: [{ type: "text", text: id }],
});

function fixture() {
	const thread = createThread({
		initialTree: {
			version: 1,
			cursorId: "a",
			nodes: [
				{ message: message("root"), parentId: null },
				{ message: message("a"), parentId: "root" },
				{ message: message("b"), parentId: "root" },
			],
		},
	});
	return {
		thread,
		a: createView("c", "left", "a"),
		b: createView("c", "right", "b"),
	};
}

test("real Thread path projection and scoped drafts survive independent navigation", () => {
	const { thread, a, b } = fixture();
	editDraft(a, "left draft");
	editDraft(b, "right draft");
	a.setState({ cursorId: "root" });
	expect(thread.getPath(a.getState().cursorId).map((m) => m.id)).toEqual([
		"root",
	]);
	expect(thread.getPath(b.getState().cursorId).map((m) => m.id)).toEqual([
		"root",
		"b",
	]);
	expect(thread.getSnapshot().cursorId).toBe("a");
	expect(b.getState().draft).toBe("right draft");
	expect(draftKey(a, "user1")).not.toBe(draftKey(b, "user1"));
	expect(draftKey(a, "user1")).not.toBe(draftKey(a, "user2"));
});

test("late send does not steal navigation, clear new typing, or touch another view", async () => {
	const { a, b } = fixture();
	const pending = Promise.withResolvers<{
		messageId: string;
		executionId: string;
	}>();
	const requests: string[] = [];
	const service = defineServices({
		models: ["fast", "careful"],
		defaultModel: "fast",
		send: (request) => {
			requests.push(
				`${request.viewId}:${request.parentMessageId}:${request.model}:${request.text}`,
			);
			return pending.promise;
		},
		stop: async () => {},
		approve: async () => {},
	});
	editDraft(a, "submitted");
	const sending = bindComposer(a, service)("careful");
	a.setState({ cursorId: "b" });
	editDraft(a, "new typing");
	pending.resolve({ messageId: "new-a", executionId: "run-a" });
	await sending;
	expect(requests).toEqual(["left:a:careful:submitted"]);
	expect(a.getState().cursorId).toBe("b");
	expect(a.getState().draft).toBe("new typing");
	expect(b.getState().cursorId).toBe("b");
});

test("switch away and back invalidates late result through binding generation", async () => {
	const { a } = fixture();
	const pending = Promise.withResolvers<{
		messageId: string;
		executionId: string;
	}>();
	const sending = bindComposer(a, {
		defaultModel: "fast",
		send: () => pending.promise,
	})();
	a.setState({ bindingVersion: 2 });
	pending.resolve({ messageId: "stale", executionId: "stale-run" });
	await sending;
	expect(a.getState().cursorId).toBe("a");
});

test("origin-targeted stop and approval survive view navigation and panel removal", async () => {
	const { a } = fixture();
	const calls: string[] = [];
	const origin: Origin = {
		conversationId: "c",
		viewId: "left",
		messageId: "a",
		executionId: "run-a",
	};
	const controls = bindControls(origin, {
		stop: async (target) => {
			calls.push(`stop:${target.executionId}`);
		},
		approve: async (target, id) => {
			calls.push(`approve:${target.executionId}:${id}`);
		},
	});
	const panel = createView("c", "document", "a");
	const unsubscribe = panel.subscribe(() => {});
	unsubscribe();
	a.setState({ cursorId: "b", conversationId: "other" });
	expect(calls).toEqual([]); // disposal/navigation invokes no execution mutation
	await controls.stop();
	await controls.approve("approval-a", true);
	expect(calls).toEqual(["stop:run-a", "approve:run-a:approval-a"]);
});

test("two functional consumers share Query cache; caller namespace isolates data", async () => {
	const query = new QueryClient();
	let reads = 0;
	const options = {
		queryKey: ["history", "user1"],
		staleTime: Infinity,
		queryFn: async () => {
			reads++;
			return [{ id: "c", title: "Shared conversation" }];
		},
	};
	const [a, b] = await Promise.all([
		query.fetchQuery(options),
		query.fetchQuery(options),
	]);
	expect(a).toEqual(b);
	expect(reads).toBe(1);
	expect(query.getQueryData(["history", "user2"])).toBeUndefined();
	await query.invalidateQueries({ queryKey: options.queryKey });
	await query.fetchQuery(options);
	expect(reads).toBe(2);
	query.clear();
});
