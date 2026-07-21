import {
	AbstractChat,
	type ChatRequestOptions,
	type ChatState,
	type ChatStatus,
	type ChatTransport,
	type UIMessage,
} from "ai";
import type { ThreadChatOptions } from "./types";

export type ThreadRunSpec = {
	id: string;
	messageId?: string;
	parentMessageId: string | null;
	siblingOrder: number;
};

export interface ThreadRunHost<TMessage extends UIMessage> {
	readonly dataPartSchemas: ThreadChatOptions<TMessage>["dataPartSchemas"];
	readonly id: string;
	readonly messageMetadataSchema: ThreadChatOptions<TMessage>["messageMetadataSchema"];
	onData: ThreadChatOptions<TMessage>["onData"];
	onError: ThreadChatOptions<TMessage>["onError"];
	onFinish: ThreadChatOptions<TMessage>["onFinish"];
	onToolCall: ThreadChatOptions<TMessage>["onToolCall"];
	sendAutomaticallyWhen: ThreadChatOptions<TMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<TMessage>;
	generateMessageId: () => string;
	getRunPath: (runId: string) => TMessage[];
	mergeRunPath: (messages: TMessage[]) => void;
	registerToolCall: (runId: string, toolCallId: string) => void;
	removeMessage: (messageId: string) => void;
	setRunError: (runId: string, error: Error | undefined) => void;
	setRunStatus: (runId: string, status: ChatStatus) => void;
	writeRunMessage: (runId: string, message: TMessage) => void;
}

function createPendingMessage<TMessage extends UIMessage>(id: string) {
	// AbstractChat crosses the same generic boundary when it creates a response:
	// TMessage may narrow metadata or parts beyond the base UIMessage shape.
	const message: UIMessage = { id, parts: [], role: "assistant" };
	return message as TMessage;
}

class ThreadChatState<TMessage extends UIMessage>
	implements ChatState<TMessage>
{
	#error: Error | undefined;
	readonly #host: ThreadRunHost<TMessage>;
	readonly #pendingMessage: TMessage;
	readonly #spec: ThreadRunSpec;
	#status: ChatStatus = "ready";

	constructor(
		host: ThreadRunHost<TMessage>,
		spec: ThreadRunSpec,
		pendingMessage: TMessage,
	) {
		this.#host = host;
		this.#pendingMessage = pendingMessage;
		this.#spec = spec;
	}

	get error() {
		return this.#error;
	}

	set error(error: Error | undefined) {
		this.#error = error;
		this.#host.setRunError(this.#spec.id, error);
	}

	get messages() {
		const path = this.#host.getRunPath(this.#spec.id);
		return this.#spec.messageId === undefined
			? [...path, this.#pendingMessage]
			: path;
	}

	set messages(messages: TMessage[]) {
		const pendingIndex = messages.findIndex(
			(message) => message.id === this.#pendingMessage.id,
		);
		this.#host.mergeRunPath(
			pendingIndex === -1 ? messages : messages.slice(0, pendingIndex),
		);
	}

	get status() {
		return this.#status;
	}

	set status(status: ChatStatus) {
		this.#status = status;
		this.#host.setRunStatus(this.#spec.id, status);
	}

	popMessage = () => {
		const lastMessage = this.messages.at(-1);
		if (lastMessage && lastMessage.id !== this.#pendingMessage.id) {
			this.#host.removeMessage(lastMessage.id);
		}
	};

	pushMessage = (message: TMessage) => {
		this.writeMessage(message);
	};

	replaceMessage = (index: number, message: TMessage) => {
		if (index !== this.messages.length - 1) {
			throw new Error("A thread run can only replace its current response");
		}
		this.writeMessage(message);
	};

	snapshot = <T>(thing: T): T => structuredClone(thing);

	private writeMessage(message: TMessage) {
		this.#host.writeRunMessage(this.#spec.id, message);
	}
}

export class ThreadRunChat<
	TMessage extends UIMessage,
> extends AbstractChat<TMessage> {
	constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
		const pendingMessageId = host.generateMessageId();
		const pendingMessage = createPendingMessage<TMessage>(pendingMessageId);
		const transport: ChatTransport<TMessage> = {
			reconnectToStream: (options) => host.transport.reconnectToStream(options),
			sendMessages: (options) => {
				const hasPendingMessage =
					spec.messageId === undefined &&
					options.messages.at(-1)?.id === pendingMessageId;
				return host.transport.sendMessages({
					...options,
					messageId: hasPendingMessage ? undefined : options.messageId,
					messages: hasPendingMessage
						? options.messages.slice(0, -1)
						: options.messages,
				});
			},
		};
		super({
			dataPartSchemas: host.dataPartSchemas,
			generateId: () => pendingMessageId,
			id: host.id,
			messageMetadataSchema: host.messageMetadataSchema,
			onData: (event) => host.onData?.(event),
			onError: (error) => {
				host.onError?.(error);
			},
			onFinish: (event) => {
				host.onFinish?.({
					...event,
					messages: host.getRunPath(spec.id),
				});
			},
			onToolCall: async (event) => {
				host.registerToolCall(spec.id, event.toolCall.toolCallId);
				await host.onToolCall?.(event);
			},
			sendAutomaticallyWhen: (event) =>
				host.sendAutomaticallyWhen?.(event) ?? false,
			state: new ThreadChatState(host, spec, pendingMessage),
			transport,
		});
	}

	start(options?: ChatRequestOptions) {
		return this.sendMessage(undefined, options);
	}
}
