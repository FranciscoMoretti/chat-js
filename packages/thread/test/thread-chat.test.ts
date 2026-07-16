import { describe, expect, test } from "bun:test";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { ThreadChat } from "../src/thread-chat";

class ControlledTransport implements ChatTransport<UIMessage> {
	readonly requests = new Map<
		string,
		{
			abortSignal: AbortSignal | undefined;
			controller: ReadableStreamDefaultController<UIMessageChunk>;
		}
	>();

	sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) => {
		const assistantMessageId = (options.body as { assistantMessageId: string })
			.assistantMessageId;
		return Promise.resolve(
			new ReadableStream({
				start: (controller) => {
					this.requests.set(assistantMessageId, {
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

	reconnectToStream() {
		return Promise.resolve(null);
	}

	emitText(assistantMessageId: string, text: string) {
		const controller = this.requests.get(assistantMessageId)?.controller;
		controller?.enqueue({ messageId: assistantMessageId, type: "start" });
		controller?.enqueue({ id: "text", type: "text-start" });
		controller?.enqueue({ delta: text, id: "text", type: "text-delta" });
		controller?.enqueue({ id: "text", type: "text-end" });
		controller?.close();
	}
}

function user(id: string): UIMessage {
	return { id, parts: [{ text: id, type: "text" }], role: "user" };
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
			request: { body: { assistantMessageId: "assistant-1" } },
		});
		const alternative = await chat.startRun({
			follow: false,
			from: "user-1",
			request: { body: { assistantMessageId: "assistant-2" } },
		});
		await waitFor(() => transport.requests.size === 2);

		transport.emitText("assistant-2", "second");
		transport.emitText("assistant-1", "first");
		await Promise.all([primary.finished, alternative.finished]);

		expect(chat.getSiblings("assistant-1").map(({ id }) => id)).toEqual([
			"assistant-1",
			"assistant-2",
		]);
		expect(chat.getSnapshot().cursorId).toBe("assistant-1");
	});

	test("claims an optimistic assistant placeholder for its reserved run", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		chat.addMessage(user("user-1"), null);
		chat.addMessage(
			{
				id: "assistant-1",
				metadata: { lifecycle: "pending" },
				parts: [],
				role: "assistant",
			},
			"user-1",
		);

		const run = await chat.startRun({
			from: "user-1",
			request: { body: { assistantMessageId: "assistant-1" } },
		});
		await waitFor(() => transport.requests.has("assistant-1"));

		expect(chat.getMessage("assistant-1")?.metadata).toEqual({
			lifecycle: "pending",
		});
		transport.emitText("assistant-1", "claimed");
		await run.finished;
		expect(getMessageText(chat.getMessage("assistant-1") as UIMessage)).toBe(
			"claimed",
		);
	});

	test("does not claim a populated assistant as a new run", async () => {
		const chat = new ThreadChat();
		chat.addMessage(user("user-1"), null);
		chat.addMessage(
			{
				id: "assistant-1",
				parts: [{ text: "complete", type: "text" }],
				role: "assistant",
			},
			"user-1",
		);

		await expect(
			chat.startRun({
				from: "user-1",
				request: { body: { assistantMessageId: "assistant-1" } },
			}),
		).rejects.toThrow("unavailable");
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

	test("rejects concurrency before adding optimistic nodes", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({
			concurrency: { maxActiveRuns: 1 },
			transport,
		});
		await chat.startRun({
			message: user("user-1"),
			request: { body: { assistantMessageId: "assistant-1" } },
		});

		await expect(
			chat.startRun({
				message: user("user-2"),
				request: { body: { assistantMessageId: "assistant-2" } },
			}),
		).rejects.toThrow("max active runs");
		expect(chat.getMessage("user-2")).toBeUndefined();
	});

	test("stopping one run does not abort another", async () => {
		const transport = new ControlledTransport();
		const chat = new ThreadChat({ transport });
		const first = await chat.startRun({
			message: user("user-1"),
			request: { body: { assistantMessageId: "assistant-1" } },
		});
		const second = await chat.startRun({
			from: "user-1",
			request: { body: { assistantMessageId: "assistant-2" } },
		});
		await waitFor(() => transport.requests.size === 2);

		await first.stop();
		expect(
			transport.requests.get("assistant-1")?.abortSignal?.aborted,
		).toBeTrue();
		expect(
			transport.requests.get("assistant-2")?.abortSignal?.aborted,
		).toBeFalse();
		transport.emitText("assistant-2", "complete");
		await second.finished;
	});
});
