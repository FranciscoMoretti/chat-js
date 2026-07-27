import {
	AbstractChat,
	type ChatRequestOptions,
	type ChatState,
	type ChatStatus,
	type ChatTransport,
	type UIMessage,
} from "ai";
import type { ThreadInit } from "./types";

export type ThreadRunSpec = {
	id: string;
	messageId?: string;
	parentMessageId: string | null;
	siblingOrder: number;
};

export interface ThreadRunHost<TMessage extends UIMessage> {
	readonly dataPartSchemas: ThreadInit<TMessage>["dataPartSchemas"];
	readonly id: string;
	readonly messageMetadataSchema: ThreadInit<TMessage>["messageMetadataSchema"];
	onData: ThreadInit<TMessage>["onData"];
	onError: ThreadInit<TMessage>["onError"];
	onFinish: ThreadInit<TMessage>["onFinish"];
	onToolCall: ThreadInit<TMessage>["onToolCall"];
	sendAutomaticallyWhen: ThreadInit<TMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<TMessage>;
	generateMessageId: () => string;
	getRunPath: (runId: string) => TMessage[];
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
		this.#host.updateRunPath(messages);
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
		if (lastMessage) this.#host.removeMessage(lastMessage.id);
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
		const responseMessageId = host.generateMessageId();
		const transport: ChatTransport<TMessage> = {
			reconnectToStream: (options) => host.transport.reconnectToStream(options),
			sendMessages: (options) => {
				return host.transport.sendMessages({
					...options,
					messageId:
						spec.messageId === undefined ? undefined : options.messageId,
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
					messages: host.getRunPath(spec.id),
				});
			},
			onToolCall: async (event) => {
				host.registerToolCall(spec.id, event.toolCall.toolCallId);
				await host.onToolCall?.(event);
			},
			sendAutomaticallyWhen: (event) =>
				host.sendAutomaticallyWhen?.(event) ?? false,
			state: new ThreadRunState(host, spec),
			transport,
		});
	}

	start(options?: ChatRequestOptions) {
		return this.sendMessage(undefined, options);
	}
}
