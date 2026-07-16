import {
	AbstractChat,
	type ChatState,
	type ChatStatus,
	type ChatTransport,
	type UIMessage,
} from "ai";
import type { ThreadChatOptions, ThreadRunSpec } from "./types";

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
	finishRequest: (runId: string, isAbort: boolean) => void;
	getPath: (messageId: string) => TMessage[];
	hasAssistantStarted: (messageId: string) => boolean;
	indexMessageOwnership: (runId: string, message: TMessage) => void;
	markAssistantStarted: (messageId: string) => void;
	mergeRunPath: (messages: TMessage[]) => void;
	registerToolCall: (runId: string, toolCallId: string) => void;
	removeMessage: (messageId: string) => void;
	setRunError: (runId: string, error: Error | undefined) => void;
	setRunStatus: (runId: string, status: ChatStatus) => void;
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
		this.#host.setRunError(this.#spec.runId, error);
	}

	get messages() {
		const leafId = this.#host.hasAssistantStarted(this.#spec.assistantMessageId)
			? this.#spec.assistantMessageId
			: this.#spec.userMessageId;
		return this.#host.getPath(leafId);
	}

	set messages(messages: TMessage[]) {
		this.#host.mergeRunPath(messages);
	}

	get status() {
		return this.#status;
	}

	set status(status: ChatStatus) {
		this.#status = status;
		this.#host.setRunStatus(this.#spec.runId, status);
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
			const assistantMessage = {
				...message,
				id: this.#spec.assistantMessageId,
			};
			this.#host.markAssistantStarted(this.#spec.assistantMessageId);
			this.#host.upsertMessage(assistantMessage, this.#spec.userMessageId);
			this.#host.indexMessageOwnership(this.#spec.runId, assistantMessage);
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
			generateId: () => spec.assistantMessageId,
			id: host.id,
			messageMetadataSchema: host.messageMetadataSchema,
			onData: (event) => host.onData?.(event),
			onError: (error) => {
				host.setRunError(spec.runId, error);
				host.onError?.(error);
			},
			onFinish: (event) => {
				const assistantMessage = {
					...event.message,
					id: spec.assistantMessageId,
				};
				host.upsertMessage(assistantMessage, spec.userMessageId, {
					silent: true,
				});
				host.indexMessageOwnership(spec.runId, assistantMessage);
				host.finishRequest(spec.runId, event.isAbort);
				host.onFinish?.({
					...event,
					message: assistantMessage,
					messages: host.getPath(spec.assistantMessageId),
				});
			},
			onToolCall: async (event) => {
				host.registerToolCall(spec.runId, event.toolCall.toolCallId);
				await host.onToolCall?.(event);
			},
			sendAutomaticallyWhen: (event) =>
				host.sendAutomaticallyWhen?.(event) ?? false,
			state: new ThreadChatState(host, spec),
			transport,
		});
	}
}
