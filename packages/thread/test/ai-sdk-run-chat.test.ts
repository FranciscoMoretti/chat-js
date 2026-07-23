import { describe, expect, test } from "bun:test";
import { Chat } from "@ai-sdk/react";
import type { ChatStatus, ChatTransport, UIMessage, UIMessageChunk } from "ai";
import {
	ThreadRunChat,
	type ThreadRunHost,
	type ThreadRunSpec,
} from "../src/ai-sdk-run-chat";
import { MessageTree } from "../src/message-tree";

class ControlledTransport implements ChatTransport<UIMessage> {
	readonly requests: Array<{
		controller: ReadableStreamDefaultController<UIMessageChunk>;
		options: Parameters<ChatTransport<UIMessage>["sendMessages"]>[0];
	}> = [];

	get request() {
		return this.requests.at(-1)?.options;
	}

	sendMessages: ChatTransport<UIMessage>["sendMessages"] = (options) => {
		return Promise.resolve(
			new ReadableStream({
				start: (controller) => {
					this.requests.push({ controller, options });
				},
			}),
		);
	};

	reconnectToStream() {
		return Promise.resolve(null);
	}

	emit(...chunks: UIMessageChunk[]) {
		for (const chunk of chunks) {
			this.requests.at(-1)?.controller.enqueue(chunk);
		}
	}

	finish() {
		this.requests.at(-1)?.controller.close();
	}

	fail(error: Error) {
		this.requests.at(-1)?.controller.error(error);
	}
}

class TestRunHost implements ThreadRunHost<UIMessage> {
	readonly dataPartSchemas = undefined;
	readonly id = "thread-chat";
	readonly messageMetadataSchema = undefined;
	readonly generateMessageId = () => "client-response";
	readonly spec: ThreadRunSpec;
	readonly tree: MessageTree<UIMessage>;
	onData: ThreadRunHost<UIMessage>["onData"];
	onError: ThreadRunHost<UIMessage>["onError"];
	onFinish: ThreadRunHost<UIMessage>["onFinish"];
	onToolCall: ThreadRunHost<UIMessage>["onToolCall"];
	sendAutomaticallyWhen: ThreadRunHost<UIMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<UIMessage>;
	status: ChatStatus = "ready";
	readonly errors: Error[] = [];

	constructor(
		transport: ChatTransport<UIMessage>,
		userMessage: UIMessage,
		spec: ThreadRunSpec,
	) {
		this.transport = transport;
		this.spec = spec;
		this.tree = new MessageTree({ messages: [userMessage] });
	}

	getRunPath = () =>
		this.tree.getPath(this.spec.messageId ?? this.spec.parentMessageId);
	updateRunPath = (messages: UIMessage[]) => {
		this.tree.updatePath(messages);
	};
	registerToolCall() {}
	removeMessage = (messageId: string) => this.tree.removeLeaf(messageId);
	setRunError = (_runId: string, error: Error | undefined) => {
		if (error) this.errors.push(error);
	};
	setRunStatus = (_runId: string, status: ChatStatus) => {
		this.status = status;
	};
	writeRunMessage = (_runId: string, message: UIMessage) => {
		if (this.spec.messageId && this.spec.messageId !== message.id) {
			throw new Error("Run message identity changed");
		}
		if (!this.spec.messageId && this.tree.has(message.id)) {
			throw new Error("Run message identity already exists");
		}
		this.spec.messageId = message.id;
		this.tree.upsertMessage(message, this.spec.parentMessageId);
	};
}

function userMessage(): UIMessage {
	return {
		id: "user-1",
		parts: [{ text: "Compare me", type: "text" }],
		role: "user",
	};
}

function createSpec(): ThreadRunSpec {
	return {
		id: "run-1",
		parentMessageId: "user-1",
		siblingOrder: 0,
	};
}

function emitRichResponse(transport: ControlledTransport) {
	transport.emit(
		{ messageId: "assistant-1", type: "start" },
		{ id: "reasoning-1", type: "reasoning-start" },
		{ delta: "thinking", id: "reasoning-1", type: "reasoning-delta" },
		{ id: "reasoning-1", type: "reasoning-end" },
		{ id: "text-1", type: "text-start" },
		{ delta: "answer", id: "text-1", type: "text-delta" },
		{ id: "text-1", type: "text-end" },
		{ finishReason: "stop", type: "finish" },
	);
	transport.finish();
}

async function waitFor(predicate: () => boolean) {
	for (let attempt = 0; attempt < 500; attempt += 1) {
		if (predicate()) return;
		await Bun.sleep(1);
	}
	throw new Error("Timed out waiting for request");
}

describe("ThreadRunChat", () => {
	test("matches the AI SDK React Chat reducer for one response", async () => {
		const spec = createSpec();
		const standardTransport = new ControlledTransport();
		const threadTransport = new ControlledTransport();
		const input = userMessage();
		const standardChat = new Chat<UIMessage>({
			generateId: () => "client-response",
			id: "standard-chat",
			transport: standardTransport,
		});
		const host = new TestRunHost(threadTransport, input, spec);
		const threadRunChat = new ThreadRunChat(host, spec);

		const standardRequest = standardChat.sendMessage(input);
		const threadRequest = threadRunChat.start();
		await Bun.sleep(0);
		expect(threadTransport.request?.messages).toEqual(
			standardTransport.request?.messages,
		);
		expect(threadTransport.request?.messageId).toBe(
			standardTransport.request?.messageId,
		);
		emitRichResponse(standardTransport);
		emitRichResponse(threadTransport);
		await Promise.all([standardRequest, threadRequest]);

		expect(host.tree.getMessage("assistant-1")).toEqual(
			standardChat.messages.at(-1),
		);
		expect(host.status).toBe("ready");
	});

	test("adopts the server response identity from the start chunk", async () => {
		const spec = createSpec();
		const transport = new ControlledTransport();
		const input = userMessage();
		const host = new TestRunHost(transport, input, spec);
		const chat = new ThreadRunChat(host, spec);

		const request = chat.start();
		await Bun.sleep(0);
		transport.emit(
			{ messageId: "server-id", type: "start" },
			{ id: "text-1", type: "text-start" },
			{ delta: "answer", id: "text-1", type: "text-delta" },
			{ id: "text-1", type: "text-end" },
		);
		transport.finish();
		await request;

		expect(host.tree.getMessage("client-response")).toBeUndefined();
		expect(host.tree.getMessage("server-id")?.id).toBe("server-id");
		expect(spec.messageId).toBe("server-id");
	});

	test("reports a failed stream exactly once without adding a response", async () => {
		const error = new Error("stream failed");
		const callbackErrors: Error[] = [];
		const spec = createSpec();
		const transport = new ControlledTransport();
		const host = new TestRunHost(transport, userMessage(), spec);
		host.onError = (callbackError) => callbackErrors.push(callbackError);
		const chat = new ThreadRunChat(host, spec);

		const request = chat.start();
		await waitFor(() => transport.requests.length === 1);
		transport.fail(error);
		await request;

		expect(host.errors).toEqual([error]);
		expect(callbackErrors).toEqual([error]);
		expect(host.status).toBe("error");
		expect(host.tree.getChildren(spec.parentMessageId)).toEqual([]);
	});

	test("continues one response after an automatic tool follow-up", async () => {
		const spec = createSpec();
		const transport = new ControlledTransport();
		const host = new TestRunHost(transport, userMessage(), spec);
		host.sendAutomaticallyWhen = () => transport.requests.length < 2;
		const chat = new ThreadRunChat(host, spec);

		const request = chat.start();
		await waitFor(() => transport.requests.length === 1);
		transport.emit(
			{ messageId: "assistant-1", type: "start" },
			{
				dynamic: true,
				input: { city: "London" },
				toolCallId: "tool-1",
				toolName: "weather",
				type: "tool-input-available",
			},
			{
				dynamic: true,
				output: { temperature: 22 },
				toolCallId: "tool-1",
				type: "tool-output-available",
			},
			{ finishReason: "tool-calls", type: "finish" },
		);
		transport.finish();

		await waitFor(() => transport.requests.length === 2);
		expect(transport.requests[1]?.options.messageId).toBe("assistant-1");
		transport.emit(
			{ messageId: "assistant-1", type: "start" },
			{ id: "second", type: "text-start" },
			{ delta: "It is 22 degrees.", id: "second", type: "text-delta" },
			{ id: "second", type: "text-end" },
			{ finishReason: "stop", type: "finish" },
		);
		transport.finish();
		await request;

		expect(transport.requests).toHaveLength(2);
		expect(
			host.tree.getChildren(spec.parentMessageId).map(({ id }) => id),
		).toEqual(["assistant-1"]);
		expect(host.tree.getMessage("assistant-1")?.parts).toEqual([
			expect.objectContaining({
				output: { temperature: 22 },
				state: "output-available",
				toolCallId: "tool-1",
				type: "dynamic-tool",
			}),
			expect.objectContaining({
				text: "It is 22 degrees.",
				type: "text",
			}),
		]);
		expect(host.status).toBe("ready");
	});
});
