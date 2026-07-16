import { describe, expect, test } from "bun:test";
import { Chat } from "@ai-sdk/react";
import type { ChatStatus, ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { ThreadRunChat, type ThreadRunHost } from "../src/ai-sdk-run-chat";
import { MessageTree } from "../src/message-tree";
import type { ThreadRunSpec } from "../src/types";

class ControlledTransport implements ChatTransport<UIMessage> {
	controller: ReadableStreamDefaultController<UIMessageChunk> | undefined;

	sendMessages: ChatTransport<UIMessage>["sendMessages"] = () =>
		Promise.resolve(
			new ReadableStream({
				start: (controller) => {
					this.controller = controller;
				},
			}),
		);

	reconnectToStream() {
		return Promise.resolve(null);
	}

	emit(...chunks: UIMessageChunk[]) {
		for (const chunk of chunks) {
			this.controller?.enqueue(chunk);
		}
	}

	finish() {
		this.controller?.close();
	}
}

class TestRunHost implements ThreadRunHost<UIMessage> {
	readonly dataPartSchemas = undefined;
	readonly id = "thread-chat";
	readonly messageMetadataSchema = undefined;
	readonly tree: MessageTree<UIMessage>;
	onData: ThreadRunHost<UIMessage>["onData"];
	onError: ThreadRunHost<UIMessage>["onError"];
	onFinish: ThreadRunHost<UIMessage>["onFinish"];
	onToolCall: ThreadRunHost<UIMessage>["onToolCall"];
	sendAutomaticallyWhen: ThreadRunHost<UIMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<UIMessage>;
	readonly started = new Set<string>();
	status: ChatStatus = "ready";

	constructor(transport: ChatTransport<UIMessage>, userMessage: UIMessage) {
		this.transport = transport;
		this.tree = new MessageTree({ messages: [userMessage] });
	}

	finishRequest() {}
	getPath = (messageId: string) => this.tree.getPath(messageId);
	hasAssistantStarted = (messageId: string) => this.started.has(messageId);
	indexMessageOwnership() {}
	markAssistantStarted = (messageId: string) => {
		this.started.add(messageId);
	};
	mergeRunPath = (messages: UIMessage[]) => {
		this.tree.reconcilePath(messages, { moveCursor: false });
	};
	registerToolCall() {}
	removeMessage = (messageId: string) => this.tree.removeLeaf(messageId);
	setRunError = (_runId: string, error: Error | undefined) => {
		this.onError?.(error as Error);
	};
	setRunStatus = (_runId: string, status: ChatStatus) => {
		this.status = status;
	};
	upsertMessage = (message: UIMessage, parentId: string | null) => {
		this.tree.upsertMessage(message, parentId);
	};
}

function userMessage(): UIMessage {
	return {
		id: "user-1",
		parts: [{ text: "Compare me", type: "text" }],
		role: "user",
	};
}

const spec: ThreadRunSpec = {
	assistantMessageId: "assistant-1",
	follow: true,
	originCursorId: null,
	parentMessageId: null,
	runId: "assistant-1",
	userMessageId: "user-1",
};

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

describe("ThreadRunChat", () => {
	test("matches the AI SDK React Chat reducer for one response", async () => {
		const standardTransport = new ControlledTransport();
		const threadTransport = new ControlledTransport();
		const input = userMessage();
		const standardChat = new Chat<UIMessage>({
			generateId: () => spec.assistantMessageId,
			id: "standard-chat",
			transport: standardTransport,
		});
		const host = new TestRunHost(threadTransport, input);
		const threadRunChat = new ThreadRunChat(host, spec);

		const standardRequest = standardChat.sendMessage(input);
		const threadRequest = threadRunChat.sendMessage(input);
		await Bun.sleep(0);
		emitRichResponse(standardTransport);
		emitRichResponse(threadTransport);
		await Promise.all([standardRequest, threadRequest]);

		expect(host.tree.getMessage(spec.assistantMessageId)).toEqual(
			standardChat.messages.at(-1),
		);
		expect(host.status).toBe("ready");
	});

	test("keeps the reserved assistant identity when the stream sends another ID", async () => {
		const transport = new ControlledTransport();
		const input = userMessage();
		const host = new TestRunHost(transport, input);
		const chat = new ThreadRunChat(host, spec);

		const request = chat.sendMessage(input);
		await Bun.sleep(0);
		transport.emit(
			{ messageId: "server-id", type: "start" },
			{ id: "text-1", type: "text-start" },
			{ delta: "answer", id: "text-1", type: "text-delta" },
			{ id: "text-1", type: "text-end" },
		);
		transport.finish();
		await request;

		expect(host.tree.getMessage("server-id")).toBeUndefined();
		expect(host.tree.getMessage(spec.assistantMessageId)?.id).toBe(
			spec.assistantMessageId,
		);
	});
});
