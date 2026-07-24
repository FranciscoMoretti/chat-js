import {
	type AbstractChat,
	type ChatRequestOptions,
	type ChatStatus,
	type ChatTransport,
	convertFileListToFileUIParts,
	DefaultChatTransport,
	generateId,
	type UIMessage,
} from "ai";
import {
	ThreadRunChat,
	type ThreadRunHost,
	type ThreadRunSpec,
} from "./ai-sdk-run-chat";
import { MessageTree } from "./message-tree";
import { type RunRecord, RunRegistry } from "./run-registry";
import type {
	MessageTreeSnapshot,
	ThreadChatOptions,
	ThreadRunHandle,
	ThreadStartRunOptions,
	ThreadStateSnapshot,
	TreeSendOptions,
} from "./types";

type SendMessageInput<TMessage extends UIMessage> = Parameters<
	AbstractChat<TMessage>["sendMessage"]
>[0];

function getInputMessageId<TMessage extends UIMessage>(
	input: NonNullable<SendMessageInput<TMessage>>,
) {
	if ("id" in input && typeof input.id === "string") {
		return input.id;
	}
	return input.messageId;
}

function specializeMessage<TMessage extends UIMessage>(message: UIMessage) {
	// Like AI SDK's AbstractChat, construction crosses a generic boundary here:
	// TMessage may narrow metadata or parts beyond the base UIMessage shape.
	return message as TMessage;
}

async function createMessageFromInput<TMessage extends UIMessage>({
	fallbackId,
	input,
}: {
	fallbackId: string;
	input: NonNullable<SendMessageInput<TMessage>>;
}): Promise<TMessage> {
	const messageId = getInputMessageId(input) ?? fallbackId;
	const metadata = "metadata" in input ? input.metadata : undefined;
	if ("text" in input && typeof input.text === "string") {
		const fileParts =
			"files" in input && input.files
				? Array.isArray(input.files)
					? input.files
					: await convertFileListToFileUIParts(input.files)
				: [];
		return specializeMessage<TMessage>({
			id: messageId,
			metadata,
			parts: [...fileParts, { text: input.text, type: "text" }],
			role: "user",
		});
	}
	if ("files" in input && input.files) {
		return specializeMessage<TMessage>({
			id: messageId,
			metadata,
			parts: Array.isArray(input.files)
				? input.files
				: await convertFileListToFileUIParts(input.files),
			role: "user",
		});
	}
	return specializeMessage<TMessage>({
		...input,
		id: messageId,
		metadata,
		parts: "parts" in input ? input.parts : [],
		role: input.role ?? "user",
	});
}

export class ThreadChat<TMessage extends UIMessage = UIMessage>
	implements ThreadRunHost<TMessage>
{
	readonly id: string;
	readonly dataPartSchemas: ThreadChatOptions<TMessage>["dataPartSchemas"];
	readonly generateMessageId: NonNullable<
		ThreadChatOptions<TMessage>["generateId"]
	>;
	readonly messageMetadataSchema: ThreadChatOptions<TMessage>["messageMetadataSchema"];
	onData: ThreadChatOptions<TMessage>["onData"];
	onError: ThreadChatOptions<TMessage>["onError"];
	onFinish: ThreadChatOptions<TMessage>["onFinish"];
	onToolCall: ThreadChatOptions<TMessage>["onToolCall"];
	sendAutomaticallyWhen: ThreadChatOptions<TMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<TMessage>;

	readonly #listeners = new Set<() => void>();
	readonly #runs: RunRegistry<TMessage>;
	readonly #tree: MessageTree<TMessage>;
	#snapshot: ThreadStateSnapshot<TMessage>;

	constructor(options: ThreadChatOptions<TMessage> = {}) {
		this.id = options.id ?? generateId();
		this.dataPartSchemas = options.dataPartSchemas;
		this.generateMessageId = options.generateId ?? generateId;
		this.messageMetadataSchema = options.messageMetadataSchema;
		this.onData = options.onData;
		this.onError = options.onError;
		this.onFinish = options.onFinish;
		this.onToolCall = options.onToolCall;
		this.sendAutomaticallyWhen = options.sendAutomaticallyWhen;
		this.transport = options.transport ?? new DefaultChatTransport();
		this.#runs = new RunRegistry(options.concurrency);
		this.#tree = new MessageTree({
			messages: options.messages,
			snapshot: options.initialTree,
		});
		this.#snapshot = this.buildSnapshot();
	}

	getSnapshot = () => this.#snapshot;

	updateOptions(options: ThreadChatOptions<TMessage>) {
		if ("onData" in options) this.onData = options.onData;
		if ("onError" in options) this.onError = options.onError;
		if ("onFinish" in options) this.onFinish = options.onFinish;
		if ("onToolCall" in options) this.onToolCall = options.onToolCall;
		if ("sendAutomaticallyWhen" in options) {
			this.sendAutomaticallyWhen = options.sendAutomaticallyWhen;
		}
		if (options.transport) this.transport = options.transport;
	}

	subscribe = (listener: () => void) => {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	};

	addMessage(message: TMessage, parentId: string | null) {
		this.upsertMessage(message, parentId);
	}

	addToolApprovalResponse: AbstractChat<TMessage>["addToolApprovalResponse"] =
		async (response) => {
			const run = this.#runs.getForApproval(response.id);
			await run.chat.addToolApprovalResponse(response);
		};

	addToolOutput: AbstractChat<TMessage>["addToolOutput"] = async (output) => {
		const run = this.#runs.getForToolCall(output.toolCallId);
		await run.chat.addToolOutput(output);
	};

	addToolResult: AbstractChat<TMessage>["addToolResult"] = this.addToolOutput;

	getTreeSnapshot() {
		return this.#tree.getSnapshot();
	}

	getChildren(messageId: string | null) {
		return this.#tree.getChildren(messageId);
	}

	getLeaves(messageId: string | null = null) {
		return this.#tree.getLeaves(messageId);
	}

	getMessage(messageId: string) {
		return this.#tree.getMessage(messageId);
	}

	getParent(messageId: string) {
		return this.#tree.getParent(messageId);
	}

	getPath(messageId?: string | null) {
		return this.#tree.getPath(messageId);
	}

	getSiblings(messageId: string) {
		return this.#tree.getSiblings(messageId);
	}

	setCursor(messageId: string | null) {
		this.#runs.select(null);
		this.#tree.setCursor(messageId);
		this.emit();
	}

	setCursorToParentOf(messageId: string) {
		this.#runs.select(null);
		this.#tree.setCursorToParentOf(messageId);
		this.emit();
	}

	getRunPath(runId: string) {
		const run = this.#runs.require(runId);
		return this.#tree.getPath(run.spec.messageId ?? run.spec.parentMessageId);
	}

	writeRunMessage(runId: string, message: TMessage) {
		const run = this.#runs.require(runId);
		const currentMessageId = run.spec.messageId;
		if (currentMessageId && currentMessageId !== message.id) {
			throw new Error(
				`Run ${runId} is already bound to message ${currentMessageId}`,
			);
		}
		if (!currentMessageId) {
			const existingMessage = this.#tree.getMessage(message.id);
			if (existingMessage) {
				throw new Error(`Message ${message.id} already exists`);
			}
			run.spec.messageId = message.id;
		}

		const insertionIndex = this.#runs.getInsertionIndex({
			childIds: this.#tree
				.getChildren(run.spec.parentMessageId)
				.map((child) => child.id),
			parentMessageId: run.spec.parentMessageId,
			siblingOrder: run.spec.siblingOrder,
		});
		this.#tree.upsertMessage(message, run.spec.parentMessageId, {
			index: insertionIndex,
		});
		this.indexMessageOwnership(runId, message);
		if (
			this.#runs.isExplicitlySelected(runId) &&
			this.#tree.cursorId === run.spec.parentMessageId
		) {
			this.#tree.setCursor(message.id);
		}
		this.emit();
	}

	regenerate: AbstractChat<TMessage>["regenerate"] = async ({
		messageId,
		...options
	} = {}) => {
		const target =
			(messageId ? this.#tree.getMessage(messageId) : undefined) ??
			(this.#tree.cursorId
				? this.#tree.getMessage(this.#tree.cursorId)
				: undefined);
		if (!target) return;

		const parentMessageId =
			target.role === "assistant"
				? this.#tree.getParentId(target.id)
				: target.id;
		if (!parentMessageId) return;

		this.assertCanStartRun(parentMessageId);
		const run = this.startRunFromParent({
			follow: true,
			id: this.#runs.reserveId(this.generateMessageId),
			options,
			parentMessageId,
		});
		await run.finished;
	};

	upsertMessage(
		message: TMessage,
		parentId: string | null,
		options: { silent?: boolean } = {},
	) {
		this.#tree.upsertMessage(message, parentId);
		if (!options.silent) this.emit();
	}

	removeMessage(messageId: string) {
		this.#tree.removeLeaf(messageId);
		this.emit();
	}

	updateRunPath(messages: TMessage[]) {
		this.#tree.updatePath(messages);
	}

	resumeStream: AbstractChat<TMessage>["resumeStream"] = async (
		options = {},
	) => {
		const run =
			this.getSelectedRunRecord() ?? this.createRunForSelectedAssistant();
		if (!run) return;
		await this.resumeRunRequest(run, options);
	};

	resumeRun = async (runId: string, options: ChatRequestOptions = {}) => {
		await this.resumeRunRequest(this.#runs.require(runId), options);
	};

	restore(
		snapshot: MessageTreeSnapshot<TMessage>,
		options: { silent?: boolean } = {},
	) {
		this.assertCanResetTree();
		this.#runs.clear();
		this.#tree.restore(snapshot);
		if (!options.silent) this.emit();
	}

	setMessages(messages: TMessage[] | ((messages: TMessage[]) => TMessage[])) {
		const nextMessages =
			typeof messages === "function"
				? messages(this.#snapshot.messages)
				: messages;
		this.#runs.select(null);
		this.#tree.setPath(nextMessages);
		this.emit();
	}

	sendMessage = async (
		input?: SendMessageInput<TMessage>,
		options?: TreeSendOptions,
	) => {
		const { tree, ...request } = options ?? {};
		const run = await this.startRun({
			follow: tree?.follow,
			from: tree && "from" in tree ? (tree.from ?? null) : undefined,
			message: input,
			request,
		});
		await run.finished;
	};

	startRun = async ({
		follow: requestedFollow,
		from,
		message: input,
		request: options,
	}: ThreadStartRunOptions<TMessage> = {}): Promise<ThreadRunHandle> => {
		const originCursorId = from === undefined ? this.#tree.cursorId : from;
		if (originCursorId && !this.#tree.has(originCursorId)) {
			throw new Error(`Unknown message ${originCursorId}`);
		}
		const follow = requestedFollow ?? originCursorId === this.#tree.cursorId;

		if (!input) {
			const originMessage = originCursorId
				? this.#tree.getMessage(originCursorId)
				: undefined;
			if (!originMessage) {
				throw new Error("Select a message before starting a run");
			}
			this.assertCanStartRun(originMessage.id);
			return this.startRunFromParent({
				follow,
				id: this.#runs.reserveId(this.generateMessageId),
				options,
				parentMessageId: originMessage.id,
			});
		}

		const message = await createMessageFromInput({
			fallbackId: getInputMessageId(input) ?? this.generateMessageId(),
			input,
		});
		this.assertValidRunParent(message);
		const existingMessage = this.#tree.getMessage(message.id);
		this.assertCanStartRun(message.id);
		const attachmentId = existingMessage
			? (this.#tree.getParentId(message.id) ?? null)
			: originCursorId;
		this.#tree.upsertMessage(message, attachmentId);
		if (follow) this.#tree.setCursor(message.id);

		return this.startRunFromParent({
			follow,
			id: this.#runs.reserveId(this.generateMessageId),
			options,
			parentMessageId: message.id,
		});
	};

	clearError = () => {
		const run = this.getSelectedRunRecord();
		if (run) run.chat.clearError();
	};

	stop = () => this.getSelectedRunRecord()?.chat.stop() ?? Promise.resolve();

	stopAll() {
		return Promise.all(
			this.#runs.getActive().map((run) => run.chat.stop()),
		).then(() => undefined);
	}

	stopRun(runId: string) {
		return this.#runs.get(runId)?.chat.stop() ?? Promise.resolve();
	}

	stopRunForMessage(messageId: string) {
		const run = this.getRunForMessage(messageId);
		return run ? this.stopRun(run.id) : Promise.resolve();
	}

	getRun(runId: string) {
		const run = this.#runs.get(runId);
		return run ? this.#runs.toSnapshot(run) : undefined;
	}

	getRunForMessage(messageId: string) {
		const run = this.#runs.getForMessage(messageId);
		return run ? this.#runs.toSnapshot(run) : undefined;
	}

	setRunError(runId: string, error: Error | undefined) {
		this.#runs.setError(runId, error);
		this.emit();
	}

	setRunStatus(runId: string, status: ChatStatus) {
		this.#runs.setStatus(runId, status);
		this.emit();
	}

	registerToolCall(runId: string, toolCallId: string) {
		this.#runs.registerToolCall(runId, toolCallId);
	}

	indexMessageOwnership(runId: string, message: TMessage) {
		this.#runs.indexMessageOwnership(runId, message);
	}

	private buildSnapshot(): ThreadStateSnapshot<TMessage> {
		const tree = this.#tree.getSnapshot();
		const indexes = this.#tree.getIndexes();
		const runSnapshot = this.#runs.getSnapshot();
		const selectedRun = this.getSelectedRunRecord();
		return {
			...tree,
			...indexes,
			activeRuns: runSnapshot.activeRuns,
			error: selectedRun?.error,
			messages: this.#tree.getPath(),
			runs: runSnapshot.runs,
			status: selectedRun?.status ?? "ready",
			treeStatus: runSnapshot.status,
		};
	}

	private emit() {
		this.#snapshot = this.buildSnapshot();
		for (const listener of this.#listeners) listener();
	}

	private assertCanStartRun(parentMessageId: string) {
		const parentMessage = this.#tree.getMessage(parentMessageId);
		if (parentMessage) this.assertValidRunParent(parentMessage);
		this.#runs.assertCanStart(parentMessageId);
	}

	private assertValidRunParent(message: TMessage) {
		if (message.role === "assistant") {
			throw new Error(
				`Cannot start a new run directly from assistant message ${message.id}; attach an input message first`,
			);
		}
	}

	private getSelectedRunRecord() {
		return this.#runs.resolveSelected({
			cursorId: this.#tree.cursorId,
			pathIds: new Set(this.#tree.getPathIds()),
		});
	}

	private createRunForSelectedAssistant() {
		const messageId = this.#tree.cursorId;
		if (!messageId) return undefined;
		const message = this.#tree.getMessage(messageId);
		if (!message || message.role !== "assistant") {
			return undefined;
		}
		const parentMessageId = this.#tree.getParentId(messageId);
		if (!parentMessageId) return undefined;

		const spec: ThreadRunSpec & { parentMessageId: string } = {
			messageId,
			parentMessageId,
			siblingOrder: this.#tree
				.getChildren(parentMessageId)
				.findIndex((child) => child.id === messageId),
			id: this.#runs.reserveId(this.generateMessageId),
		};
		const record: RunRecord<TMessage> = {
			chat: new ThreadRunChat(this, spec),
			error: undefined,
			finished: Promise.resolve(),
			spec,
			status: "ready",
		};
		this.#runs.add(record);
		this.#runs.select(spec.id);
		this.indexMessageOwnership(spec.id, message);
		this.emit();
		return record;
	}

	private assertCanResetTree() {
		if (this.#runs.getActive().length > 0) {
			throw new Error("Cannot replace the tree while runs are active");
		}
	}

	private startRunFromParent({
		follow,
		id,
		options,
		parentMessageId,
	}: Omit<ThreadRunSpec, "messageId" | "parentMessageId" | "siblingOrder"> & {
		follow: boolean;
		options?: ChatRequestOptions;
		parentMessageId: string;
	}) {
		const spec: ThreadRunSpec & { parentMessageId: string } = {
			id,
			parentMessageId,
			siblingOrder: this.#runs.reserveSiblingOrder(
				parentMessageId,
				this.#tree.getChildren(parentMessageId).length,
			),
		};
		if (follow) {
			this.#runs.select(id);
			this.#tree.setCursor(parentMessageId);
		}
		return this.startRunRequest(spec, options);
	}

	private startRunRequest(
		spec: ThreadRunSpec & { parentMessageId: string },
		options?: ChatRequestOptions,
	) {
		const parentMessage = this.#tree.getMessage(spec.parentMessageId);
		if (!parentMessage) {
			throw new Error(`Unknown message ${spec.parentMessageId}`);
		}
		const chat = new ThreadRunChat(this, spec);
		const record: RunRecord<TMessage> = {
			chat,
			error: undefined,
			finished: Promise.resolve(),
			spec,
			status: "submitted",
		};
		this.#runs.add(record);
		this.emit();
		const finished = chat.start(options).finally(() => this.emit());
		record.finished = finished;
		return this.createRunHandle(record);
	}

	private createRunHandle(run: RunRecord<TMessage>): ThreadRunHandle {
		return {
			get finished() {
				return run.finished;
			},
			id: run.spec.id,
			getSnapshot: () => this.getRun(run.spec.id),
			stop: () => run.chat.stop(),
		};
	}

	private async resumeRunRequest(
		run: RunRecord<TMessage>,
		options: ChatRequestOptions,
	) {
		const finished = run.chat.resumeStream(options).finally(() => this.emit());
		run.finished = finished;
		this.emit();
		await finished;
	}
}

export function createThreadChat<TMessage extends UIMessage = UIMessage>(
	options: ThreadChatOptions<TMessage> = {},
) {
	return new ThreadChat(options);
}
