import {
	AbstractChat,
	type ChatInit,
	type ChatRequestOptions,
	type ChatState,
	type ChatStatus,
	type ChatTransport,
	type UIMessage,
} from "ai";

export type ThreadRunSpec = {
	id: string;
	initialPathMessageId: string | null;
	messageId?: string;
	parentMessageId: string | null;
	siblingOrder: number;
};

export interface ThreadRunHost<TMessage extends UIMessage> {
	readonly dataPartSchemas: ChatInit<TMessage>["dataPartSchemas"];
	readonly id: string;
	readonly messageMetadataSchema: ChatInit<TMessage>["messageMetadataSchema"];
	onData: ChatInit<TMessage>["onData"];
	onError: ChatInit<TMessage>["onError"];
	onFinish: ChatInit<TMessage>["onFinish"];
	onToolCall: ChatInit<TMessage>["onToolCall"];
	sendAutomaticallyWhen: ChatInit<TMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<TMessage>;
	generateMessageId: () => string;
	getMessagePath: (messageId: string | null) => TMessage[];
	updateRunPath: (messages: TMessage[]) => void;
	registerToolCall: (runId: string, toolCallId: string) => void;
	removeMessage: (messageId: string) => void;
	setRunError: (runId: string, error: Error | undefined) => void;
	setRunStatus: (runId: string, status: ChatStatus) => void;
	writeRunMessage: (runId: string, message: TMessage) => void;
}

class ThreadRunState<TMessage extends UIMessage>
	implements ChatState<TMessage>
{
	#error: Error | undefined;
	readonly #host: ThreadRunHost<TMessage>;
	#messages: TMessage[];
	readonly #spec: ThreadRunSpec;
	#status: ChatStatus = "ready";

	constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
		this.#host = host;
		this.#messages = host.getMessagePath(spec.initialPathMessageId);
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
		return this.#messages;
	}

	set messages(messages: TMessage[]) {
		this.#messages = messages;
		this.#host.updateRunPath(messages);
	}

	get status() {
		return this.#status;
	}

	set status(status: ChatStatus) {
		this.#status = status;
		this.#host.setRunStatus(this.#spec.id, status);
	}

	refreshPath() {
		this.#messages = this.#host.getMessagePath(
			this.#spec.messageId ?? this.#spec.initialPathMessageId,
		);
	}

	popMessage = () => {
		const lastMessage = this.#messages.pop();
		if (lastMessage) this.#host.removeMessage(lastMessage.id);
	};

	pushMessage = (message: TMessage) => {
		this.#messages.push(message);
		this.writeMessage(message);
	};

	replaceMessage = (index: number, message: TMessage) => {
		if (index !== this.#messages.length - 1) {
			throw new Error("A thread run can only replace its current response");
		}
		this.#messages[index] = message;
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
	readonly #state: ThreadRunState<TMessage>;

	constructor(host: ThreadRunHost<TMessage>, spec: ThreadRunSpec) {
		const responseMessageId = host.generateMessageId();
		const state = new ThreadRunState(host, spec);
		const transport: ChatTransport<TMessage> = {
			reconnectToStream: (options) => host.transport.reconnectToStream(options),
			sendMessages: (options) => {
				return host.transport.sendMessages({
					...options,
					messageId:
						spec.messageId === undefined && options.trigger === "submit-message"
							? undefined
							: options.messageId,
				});
			},
		};
		super({
			dataPartSchemas: host.dataPartSchemas,
			generateId: () => responseMessageId,
			id: host.id,
			messageMetadataSchema: host.messageMetadataSchema,
			onData: (event) => host.onData?.(event),
			onError: (error) => {
				host.onError?.(error);
			},
			onFinish: (event) => {
				host.onFinish?.({
					...event,
					messages: host.getMessagePath(spec.messageId ?? spec.parentMessageId),
				});
			},
			onToolCall: async (event) => {
				host.registerToolCall(spec.id, event.toolCall.toolCallId);
				await host.onToolCall?.(event);
			},
			sendAutomaticallyWhen: (event) =>
				host.sendAutomaticallyWhen?.(event) ?? false,
			state,
			transport,
		});
		this.#state = state;
	}

	refreshPath() {
		this.#state.refreshPath();
	}

	start(options?: ChatRequestOptions) {
		return this.sendMessage(undefined, options);
	}

	startWithMessage(
		message: NonNullable<Parameters<AbstractChat<TMessage>["sendMessage"]>[0]>,
		options?: ChatRequestOptions,
	) {
		return this.sendMessage(message, options);
	}

	regenerateMessage(messageId: string, options?: ChatRequestOptions) {
		return this.regenerate({ ...options, messageId });
	}
}
