import { describe, expect, test } from "bun:test";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { getMessageText } from "../src/message-utils";
import { Thread } from "../src/thread";

class ControlledTransport implements ChatTransport<UIMessage> {
	readonly requests: Array<{
		abortSignal: AbortSignal | undefined;
		controller: ReadableStreamDefaultController<UIMessageChunk>;
	}> = [];
	#reconnectStream: ReadableStream<UIMessageChunk> | null = null;

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
		const stream = this.#reconnectStream;
		this.#reconnectStream = null;
		return Promise.resolve(stream);
	}

	prepareReconnect() {
		let controller: ReadableStreamDefaultController<UIMessageChunk> | undefined;
		this.#reconnectStream = new ReadableStream({
			start(value) {
				controller = value;
			},
		});
		if (!controller) throw new Error("Expected reconnect controller");
		return controller;
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

class ResumeTransport extends ControlledTransport {
	lastReconnectOptions:
		| Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
		| undefined;

	override reconnectToStream(
		options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0],
	) {
		this.lastReconnectOptions = options;
		return Promise.resolve(
			new ReadableStream<UIMessageChunk>({
				start(controller) {
					controller.enqueue({ id: "text", type: "text-start" });
					controller.enqueue({
						delta: "resumed",
						id: "text",
						type: "text-delta",
					});
					controller.enqueue({ id: "text", type: "text-end" });
					controller.enqueue({ finishReason: "stop", type: "finish" });
					controller.close();
				},
			}),
		);
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

describe("Thread", () => {
	test("streams concurrent responses into separate assistant siblings", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
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
		const chat = new Thread({ transport });
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
		const chat = new Thread({
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

	test("attaches streamed output without requiring a user parent", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
		const run = await chat.startRun({
			message: {
				id: "context-1",
				parts: [{ text: "System context", type: "text" }],
				role: "system",
			},
		});
		await waitFor(() => transport.requests.length === 1);

		transport.emitText(0, "response-1", "complete");
		await run.finished;

		expect(chat.getMessage("context-1")?.role).toBe("system");
		expect(chat.getParent("response-1")?.id).toBe("context-1");
	});

	test("rejects a bare run from an assistant before transport", async () => {
		const transport = new ControlledTransport();
		const parent: UIMessage = {
			id: "assistant-parent",
			parts: [{ text: "first", type: "text" }],
			role: "assistant",
		};
		const chat = new Thread({ messages: [parent], transport });

		await expect(chat.startRun({ from: parent.id })).rejects.toThrow(
			"Cannot start a new run directly from assistant message assistant-parent; attach an input message first",
		);
		expect(transport.requests).toHaveLength(0);
		expect(chat.getTreeSnapshot().nodes).toHaveLength(1);
		expect(chat.getSnapshot().runs).toHaveLength(0);
	});

	test("rejects an assistant input without mutating the tree", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ messages: [user("user-1")], transport });

		await expect(
			chat.sendMessage({
				id: "assistant-input",
				parts: [{ text: "prebuilt response", type: "text" }],
				role: "assistant",
			}),
		).rejects.toThrow(
			"Cannot start a new run directly from assistant message assistant-input; attach an input message first",
		);
		expect(transport.requests).toHaveLength(0);
		expect(chat.getMessage("assistant-input")).toBeUndefined();
		expect(chat.getSnapshot().cursorId).toBe("user-1");
		expect(chat.getSnapshot().runs).toHaveLength(0);
	});

	test("keeps hidden branches when reconciling the selected path", () => {
		const chat = new Thread({
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
		const chat = new Thread({ transport });
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
		const chat = new Thread({
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
		const chat = new Thread({ transport });
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
		const chat = new Thread({ transport });
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

	test("preserves an error when resume finds no stream", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
		const run = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);
		transport.fail(0, new Error("failed"));
		await run.finished;
		const error = run.getSnapshot()?.error;

		await chat.resumeRun(run.id);

		expect(run.getSnapshot()).toMatchObject({ error, status: "error" });
		chat.clearError();
		expect(run.getSnapshot()).toMatchObject({
			error: undefined,
			status: "ready",
		});
	});

	test("run handles expose the current resumed request", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
		const run = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);
		transport.emitText(0, "assistant-1", "first");
		await run.finished;
		const initialFinished = run.finished;
		const reconnect = transport.prepareReconnect();

		const resumed = chat.resumeRun(run.id);

		expect(run.finished).not.toBe(initialFinished);
		let finished = false;
		void run.finished.then(() => {
			finished = true;
		});
		await Bun.sleep(0);
		expect(finished).toBeFalse();
		reconnect.close();
		await Promise.all([resumed, run.finished]);
	});

	test("aggregate status ignores historical run errors", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
		const failed = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);
		transport.fail(0, new Error("failed"));
		await failed.finished;
		expect(chat.getSnapshot().treeStatus).toBe("ready");
		expect(failed.getSnapshot()?.status).toBe("error");

		const successful = await chat.startRun({ from: "user-1" });
		await waitFor(() => transport.requests.length === 2);
		expect(chat.getSnapshot().treeStatus).toBe("submitted");
		transport.emitText(1, "assistant-1", "recovered");
		await successful.finished;

		expect(chat.getSnapshot().status).toBe("ready");
		expect(chat.getSnapshot().treeStatus).toBe("ready");
		expect(failed.getSnapshot()?.status).toBe("error");
	});

	test("unexpected application errors reject the run promise", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({
			sendAutomaticallyWhen: () => {
				throw new Error("application callback failed");
			},
			transport,
		});
		const run = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);
		transport.emitText(0, "assistant-1", "complete");

		await expect(run.finished).rejects.toThrow("application callback failed");
	});

	test("regenerates an assistant as a sibling response", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
		const first = await chat.startRun({
			message: user("user-1"),
		});
		await waitFor(() => transport.requests.length === 1);
		transport.emitText(0, "assistant-1", "first");
		await first.finished;

		const regeneration = chat.regenerate({ messageId: "assistant-1" });
		await waitFor(() => transport.requests.length === 2);
		transport.emitText(1, "assistant-2", "second");
		await regeneration;

		expect(chat.getSiblings("assistant-1").map(({ id }) => id)).toEqual([
			"assistant-1",
			"assistant-2",
		]);
		expect(chat.getSnapshot().cursorId).toBe("assistant-2");
	});

	test("rejects an unknown explicit regeneration target", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({
			messages: [user("user-1"), { ...user("assistant-1"), role: "assistant" }],
			transport,
		});

		await expect(chat.regenerate({ messageId: "missing" })).rejects.toThrow(
			"message missing not found",
		);
		expect(transport.requests).toHaveLength(0);
		expect(chat.getSnapshot().cursorId).toBe("assistant-1");
	});

	test("rejects regeneration when the response parent is an assistant", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({
			messages: [
				{ ...user("assistant-parent"), role: "assistant" },
				{ ...user("assistant-child"), role: "assistant" },
			],
			transport,
		});

		await expect(
			chat.regenerate({ messageId: "assistant-child" }),
		).rejects.toThrow(
			"Cannot start a new run directly from assistant message assistant-parent; attach an input message first",
		);
		expect(transport.requests).toHaveLength(0);
		expect(chat.getSnapshot().runs).toHaveLength(0);
	});

	test("restores assistant-to-assistant edges as tree data", () => {
		const assistantParent = {
			...user("assistant-parent"),
			role: "assistant" as const,
		};
		const assistantChild = {
			...user("assistant-child"),
			role: "assistant" as const,
		};
		const chat = new Thread({
			initialTree: {
				cursorId: assistantChild.id,
				nodes: [
					{ message: assistantParent, parentId: null },
					{ message: assistantChild, parentId: assistantParent.id },
				],
				version: 1,
			},
		});

		expect(chat.getParent(assistantChild.id)?.id).toBe(assistantParent.id);
		expect(chat.getSnapshot().messages.map(({ id }) => id)).toEqual([
			assistantParent.id,
			assistantChild.id,
		]);
	});

	test("routes tool output and approval to their owning runs", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({ transport });
		const runA = await chat.startRun({
			message: user("user-a"),
		});
		const runB = await chat.startRun({
			follow: false,
			from: null,
			message: user("user-b"),
		});
		await waitFor(() => transport.requests.length === 2);
		for (const [requestIndex, assistantMessageId, toolCallId, approvalId] of [
			[0, "assistant-a", "tool-a", "approval-a"],
			[1, "assistant-b", "tool-b", "approval-b"],
		] as const) {
			transport.emit(requestIndex, {
				messageId: assistantMessageId,
				type: "start",
			});
			transport.emit(requestIndex, {
				dynamic: true,
				input: { branch: assistantMessageId },
				toolCallId,
				toolName: "branch-tool",
				type: "tool-input-available",
			});
			transport.emit(requestIndex, {
				approvalId,
				toolCallId,
				type: "tool-approval-request",
			});
		}
		await waitFor(
			() =>
				chat.getMessage("assistant-a")?.parts.length === 1 &&
				chat.getMessage("assistant-b")?.parts.length === 1,
		);
		transport.finish(0);
		transport.finish(1);
		await Promise.all([runA.finished, runB.finished]);

		await chat.addToolOutput({
			output: "A only",
			tool: "branch-tool",
			toolCallId: "tool-a",
		});
		await chat.addToolApprovalResponse({
			approved: true,
			id: "approval-b",
		});

		expect(chat.getMessage("assistant-a")?.parts).toContainEqual(
			expect.objectContaining({ output: "A only", toolCallId: "tool-a" }),
		);
		expect(chat.getMessage("assistant-b")?.parts).not.toContainEqual(
			expect.objectContaining({ output: "A only" }),
		);
		expect(chat.getMessage("assistant-b")?.parts).toContainEqual(
			expect.objectContaining({
				approval: expect.objectContaining({
					approved: true,
					id: "approval-b",
				}),
				state: "approval-responded",
				toolCallId: "tool-b",
			}),
		);
	});

	test("enforces the global concurrency limit before resuming", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({
			concurrency: { maxActiveRuns: 1 },
			transport,
		});
		const completed = await chat.startRun({ message: user("user-a") });
		await waitFor(() => transport.requests.length === 1);
		transport.emitText(0, "assistant-a", "complete");
		await completed.finished;

		const active = await chat.startRun({
			follow: false,
			from: null,
			message: user("user-b"),
		});
		await waitFor(() => transport.requests.length === 2);

		await expect(chat.resumeRun(completed.id)).rejects.toThrow(
			"max active runs",
		);
		transport.finish(1);
		await active.finished;
	});

	test("enforces the per-message concurrency limit before resuming", async () => {
		const transport = new ControlledTransport();
		const chat = new Thread({
			concurrency: { maxActiveRunsPerMessage: 1 },
			transport,
		});
		const completed = await chat.startRun({ message: user("user-1") });
		await waitFor(() => transport.requests.length === 1);
		transport.emitText(0, "assistant-1", "complete");
		await completed.finished;

		const active = await chat.startRun({
			follow: false,
			from: "user-1",
		});
		await waitFor(() => transport.requests.length === 2);

		await expect(chat.resumeRun(completed.id)).rejects.toThrow(
			"Cannot start another run from user-1",
		);
		transport.finish(1);
		await active.finished;
	});

	test("resumes a restored assistant through its reconstructed run", async () => {
		const transport = new ResumeTransport();
		const chat = new Thread({
			messages: [
				user("user-1"),
				{ id: "assistant-1", parts: [], role: "assistant" },
			],
			transport,
		});

		await chat.resumeStream();

		expect(getMessageText(requireMessage(chat.getMessage("assistant-1")))).toBe(
			"resumed",
		);
		expect(transport.lastReconnectOptions?.body).toBeUndefined();
	});
});
