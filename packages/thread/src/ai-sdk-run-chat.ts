import {
	AbstractChat,
	type ChatState,
	type ChatStatus,
	type ChatTransport,
	type UIMessage,
} from "ai";
import type { ThreadChatOptions } from "./types";

export type ThreadRunSpec = {
	assistantMessageId?: string;
	id: string;
	originCursorId: string | null;
	parentMessageId: string | null;
	siblingOrder: number;
	userMessageId: string;
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
	writeRunAssistantMessage: (runId: string, message: TMessage) => void;
	upsertMessage: (
		message: TMessage,
		parentId: string | null,
		options?: { silent?: boolean },
	) => void;
}

class ThreadChatState<TMessage extends UIMessage>
	implements ChatState<TMessage>
{
	#error: Error | undefined;
	readonly #host: ThreadRunHost<TMessage>;
	readonly #spec: ThreadRunSpec;
	#status: ChatStatus = "ready";

	constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
		this.#host = host;
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
		return this.#host.getRunPath(this.#spec.id);
	}

	set messages(messages: TMessage[]) {
		this.#host.mergeRunPath(messages);
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
		if (lastMessage) {
			this.#host.removeMessage(lastMessage.id);
		}
	};

	pushMessage = (message: TMessage) => {
		this.writeMessage(message);
	};

	replaceMessage = (_index: number, message: TMessage) => {
		this.writeMessage(message);
	};

	snapshot = <T>(thing: T): T => structuredClone(thing);

	private writeMessage(message: TMessage) {
		if (message.role === "assistant") {
			this.#host.writeRunAssistantMessage(this.#spec.id, message);
			return;
		}

		this.#host.upsertMessage(message, this.#spec.parentMessageId);
	}
}

export class ThreadRunChat<
	TMessage extends UIMessage,
> extends AbstractChat<TMessage> {
	constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
		const transport: ChatTransport<TMessage> = {
			reconnectToStream: (options) => host.transport.reconnectToStream(options),
			sendMessages: (options) => host.transport.sendMessages(options),
		};
		super({
			dataPartSchemas: host.dataPartSchemas,
			generateId: host.generateMessageId,
			id: host.id,
			messageMetadataSchema: host.messageMetadataSchema,
			onData: (event) => host.onData?.(event),
			onError: (error) => {
				host.setRunError(spec.id, error);
				host.onError?.(error);
			},
			onFinish: (event) => {
				const assistantMessage = event.message;
				host.onFinish?.({
					...event,
					message: assistantMessage,
					messages: host.getRunPath(spec.id),
				});
			},
			onToolCall: async (event) => {
				host.registerToolCall(spec.id, event.toolCall.toolCallId);
				await host.onToolCall?.(event);
			},
			sendAutomaticallyWhen: (event) =>
				host.sendAutomaticallyWhen?.(event) ?? false,
			state: new ThreadChatState(host, spec),
			transport,
		});
	}
}
