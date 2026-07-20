import { describe, expect, test } from "bun:test";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { getMessageText } from "../src/message-tree";
import { ThreadChat } from "../src/thread-chat";

class ControlledTransport implements ChatTransport<UIMessage> {
	readonly requests: Array<{
		abortSignal: AbortSignal | undefined;
		controller: ReadableStreamDefaultController<UIMessageChunk>;
	}> = [];

	sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) => {
		return Promise.resolve(
			new ReadableStream({
				start: (controller) => {
					this.requests.push({
						abortSignal: options.abortSignal,
						controller,
					});
					options.abortSignal?.addEventListener(
						"abort",
						() => {
							controller.enqueue({ type: "abort" });
							controller.close();
						},
						{ once: true },
					);
				},
			}),
		);
	};

	reconnectToStream(
		_options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0],
	): Promise<ReadableStream<UIMessageChunk> | null> {
		return Promise.resolve(null);
	}

	emit(requestIndex: number, chunk: UIMessageChunk) {
		this.requests[requestIndex]?.controller.enqueue(chunk);
	}

	finish(requestIndex: number) {
		this.requests[requestIndex]?.controller.close();
	}

	fail(requestIndex: number, error: Error) {
		this.requests[requestIndex]?.controller.error(error);
	}

	emitText(requestIndex: number, messageId: string, text: string) {
		const controller = this.requests[requestIndex]?.controller;
		controller?.enqueue({ messageId, type: "start" });
		controller?.enqueue({ id: "text", type: "text-start" });
		controller?.enqueue({ delta: text, id: "text", type: "text-delta" });
		controller?.enqueue({ id: "text", type: "text-end" });
		controller?.close();
	}
}

function user(id: string): UIMessage {
	return { id, parts: [{ text: id, type: "text" }], role: "user" };
}

function requireMessage(message: UIMessage | undefined) {
	if (!message) throw new Error("Expected message to exist");
	return message;
}

async function waitFor(predicate: () => boolean) {
	for (let attempt = 0; attempt < 500; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(1);
	}
	throw new Error("Timed out waiting for request");
}

describe("ThreadChat", () => {
	test("streams concurrent responses into separate assistant siblings", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		const primary = await chat.startRun({
			follow: true,
			message: user("user-1"),
		});
		const alternative = await chat.startRun({
			follow: false,
			from: "user-1",
		});
		await waitFor(() => transport.requests.length === 2);

		transport.emitText(1, "assistant-2", "second");
		transport.emitText(0, "assistant-1", "first");
		await Promise.all([primary.finished, alternative.finished]);

		expect(chat.getSiblings("assistant-1").map(({ id }) => id)).toEqual([
			"assistant-1",
			"assistant-2",
		]);
		expect(chat.getSnapshot().cursorId).toBe("assistant-1");
	});

	test("keeps a submitted response out of the tree until streaming starts", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		const run = await chat.startRun({
			message: user("user-1"),
		});
		await waitFor(() => transport.requests.length === 1);

		const runId = run.id;
		expect(chat.getChildren("user-1")).toEqual([]);
		expect(chat.getSnapshot().messages.map(({ id }) => id)).toEqual(["user-1"]);
		expect(run.getSnapshot()?.status).toBe("submitted");
		transport.emitText(0, "server-assistant", "claimed");
		await run.finished;
		expect(run.id).toBe(runId);
		expect(
			getMessageText(requireMessage(chat.getMessage("server-assistant"))),
		).toBe("claimed");
		const snapshotMessage = chat
			.getSnapshot()
			.nodes.find(({ message }) => message.id === "server-assistant")?.message;
		expect(getMessageText(requireMessage(snapshotMessage))).toBe("claimed");
	});

	test("uses AI SDK's client response ID when the stream omits one", async () => {
		const generatedIds = ["run-1", "client-response"];
		const transport = new ControlledTransport();
		const chat = new ThreadChat({
			generateId: () => generatedIds.shift() ?? "unexpected-id",
			id: "thread-1",
			transport,
		});
		const run = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);

		transport.emit(0, { id: "text", type: "text-start" });
		transport.emit(0, {
			delta: "client identity",
			id: "text",
			type: "text-delta",
		});
		transport.emit(0, { id: "text", type: "text-end" });
		transport.finish(0);
		await run.finished;

		expect(run.id).toBe("run-1");
		expect(chat.getMessage("client-response")?.id).toBe("client-response");
	});

	test("keeps hidden branches when reconciling the selected path", () => {
		const chat = new ThreadChat({
			messages: [user("user-1"), { ...user("assistant-1"), role: "assistant" }],
		});
		chat.addMessage(user("user-2"), "assistant-1");
		chat.addMessage({ ...user("assistant-2"), role: "assistant" }, "user-2");

		chat.setMessages([
			user("user-1"),
			{ ...user("assistant-1"), role: "assistant" },
			user("user-3"),
		]);

		expect(chat.getMessage("assistant-2")?.id).toBe("assistant-2");
		expect(chat.getSnapshot().messages.map(({ id }) => id)).toEqual([
			"user-1",
			"assistant-1",
			"user-3",
		]);
	});

	test("does not follow a delayed run after the active path changes", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		const primary = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);

		chat.setMessages([user("user-1")]);
		transport.emitText(0, "assistant-1", "primary");
		await primary.finished;

		expect(chat.getMessage("assistant-1")?.id).toBe("assistant-1");
		expect(chat.getSnapshot().cursorId).toBe("user-1");
	});

	test("rejects concurrency before adding another user message", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({
			concurrency: { maxActiveRuns: 1 },
			transport,
		});
		await chat.startRun({
			message: user("user-1"),
		});

		await expect(
			chat.startRun({
				message: user("user-2"),
			}),
		).rejects.toThrow("max active runs");
		expect(chat.getMessage("user-2")).toBeUndefined();
	});

	test("stopping one run does not abort another", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		const first = await chat.startRun({
			message: user("user-1"),
		});
		const second = await chat.startRun({
			from: "user-1",
		});
		await waitFor(() => transport.requests.length === 2);

		await first.stop();
		expect(transport.requests[0]?.abortSignal?.aborted).toBeTrue();
		expect(transport.requests[1]?.abortSignal?.aborted).toBeFalse();
		expect(chat.getChildren("user-1")).toEqual([]);
		transport.emitText(1, "assistant-2", "complete");
		await second.finished;
	});

	test("keeps creation order after an earlier run fails without a message", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		const failed = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);
		transport.fail(0, new Error("failed before start"));
		await failed.finished;

		const second = await chat.startRun({ from: "user-1" });
		const third = await chat.startRun({ follow: false, from: "user-1" });
		await waitFor(() => transport.requests.length === 3);
		transport.emitText(2, "assistant-3", "third");
		transport.emitText(1, "assistant-2", "second");
		await Promise.all([second.finished, third.finished]);

		expect(chat.getChildren("user-1").map(({ id }) => id)).toEqual([
			"assistant-2",
			"assistant-3",
		]);
	});
});
