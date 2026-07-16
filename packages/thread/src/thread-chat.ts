import {
	type ChatRequestOptions,
	type ChatStatus,
	type ChatTransport,
	type CreateUIMessage,
	convertFileListToFileUIParts,
	DefaultChatTransport,
	generateId,
	type UIMessage,
} from "ai";
import { ThreadRunChat, type ThreadRunHost } from "./ai-sdk-run-chat";
import { MessageTree } from "./message-tree";
import type {
	MessageTreeSnapshot,
	SendMessageInput,
	ThreadChatOptions,
	ThreadConcurrency,
	ThreadRun,
	ThreadRunHandle,
	ThreadRunSpec,
	ThreadStartRunOptions,
	ThreadStateSnapshot,
	TreeSendOptions,
} from "./types";

type RunRecord<TMessage extends UIMessage> = {
	aborted: boolean;
	chat: ThreadRunChat<TMessage>;
	error: Error | undefined;
	finished: Promise<void>;
	spec: ThreadRunSpec;
	status: ChatStatus;
};

function getAssistantMessageIdFromOptions(options?: TreeSendOptions) {
	const assistantMessageId = (
		options?.body as Record<string, unknown> | undefined
	)?.assistantMessageId;
	return typeof assistantMessageId === "string" ? assistantMessageId : null;
}

function getInputMessageId<TMessage extends UIMessage>(
	input: NonNullable<SendMessageInput<TMessage>>,
) {
	if ("id" in input && typeof input.id === "string") {
		return input.id;
	}
	return input.messageId;
}

function createEmptyAssistantMessage<TMessage extends UIMessage>(id: string) {
	return { id, parts: [], role: "assistant" } as unknown as TMessage;
}

async function createUserMessageFromInput<TMessage extends UIMessage>({
	fallbackId,
	input,
}: {
	fallbackId: string;
	input: NonNullable<SendMessageInput<TMessage>>;
}): Promise<TMessage> {
	const messageId = getInputMessageId(input) ?? fallbackId;
	const metadata = "metadata" in input ? input.metadata : undefined;
	if ("text" in input) {
		const fileParts =
			"files" in input && input.files
				? Array.isArray(input.files)
					? input.files
					: await convertFileListToFileUIParts(input.files)
				: [];
		return {
			id: messageId,
			metadata,
			parts: [...fileParts, { text: input.text, type: "text" }],
			role: "user",
		} as TMessage;
	}
	if ("files" in input && input.files) {
		return {
			id: messageId,
			metadata,
			parts: Array.isArray(input.files)
				? input.files
				: await convertFileListToFileUIParts(input.files),
			role: "user",
		} as TMessage;
	}
	return {
		...input,
		id: messageId,
		metadata,
		parts: "parts" in input ? input.parts : [],
		role: "user",
	} as TMessage;
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
	onThreadEvent: ThreadChatOptions<TMessage>["onThreadEvent"];
	onToolCall: ThreadChatOptions<TMessage>["onToolCall"];
	sendAutomaticallyWhen: ThreadChatOptions<TMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<TMessage>;

	readonly #assistantStarted = new Set<string>();
	readonly #concurrency: Required<ThreadConcurrency>;
	readonly #listeners = new Set<() => void>();
	readonly #runsById = new Map<string, RunRecord<TMessage>>();
	readonly #tree: MessageTree<TMessage>;
	#lastEvent = "Ready";
	#snapshot: ThreadStateSnapshot<TMessage>;
	#storeVersion = 0;

	constructor(options: ThreadChatOptions<TMessage> = {}) {
		this.id = options.id ?? generateId();
		this.dataPartSchemas = options.dataPartSchemas;
		this.generateMessageId = options.generateId ?? generateId;
		this.messageMetadataSchema = options.messageMetadataSchema;
		this.onData = options.onData;
		this.onError = options.onError;
		this.onFinish = options.onFinish;
		this.onThreadEvent = options.onThreadEvent;
		this.onToolCall = options.onToolCall;
		this.sendAutomaticallyWhen = options.sendAutomaticallyWhen;
		this.transport = options.transport ?? new DefaultChatTransport();
		this.#concurrency = {
			maxActiveRuns:
				options.concurrency?.maxActiveRuns ?? Number.POSITIVE_INFINITY,
			maxActiveRunsPerMessage:
				options.concurrency?.maxActiveRunsPerMessage ??
				Number.POSITIVE_INFINITY,
		};
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
		if ("onThreadEvent" in options) {
			this.onThreadEvent = options.onThreadEvent;
		}
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
		this.#tree.setCursor(messageId);
		this.emit(`Set cursor ${messageId ?? "root"}`);
		this.onThreadEvent?.({ cursorId: messageId, type: "cursor-changed" });
	}

	setCursorToParentOf(messageId: string) {
		this.#tree.setCursorToParentOf(messageId);
		this.emit(`Set cursor ${this.#tree.cursorId ?? "root"}`);
		this.onThreadEvent?.({
			cursorId: this.#tree.cursorId,
			type: "cursor-changed",
		});
	}

	hasAssistantStarted(assistantMessageId: string) {
		return this.#assistantStarted.has(assistantMessageId);
	}

	markAssistantStarted(assistantMessageId: string) {
		this.#assistantStarted.add(assistantMessageId);
	}

	upsertMessage(
		message: TMessage,
		parentId: string | null,
		options: { silent?: boolean } = {},
	) {
		this.#tree.upsertMessage(message, parentId);
		if (!options.silent) this.emit(`Upserted ${message.id}`);
	}

	removeMessage(messageId: string) {
		this.#tree.removeLeaf(messageId);
		this.emit(`Removed ${messageId}`);
	}

	replacePath(messages: TMessage[], options: { silent?: boolean } = {}) {
		this.assertCanResetTree();
		this.clearRunState();
		this.#tree.replacePath(messages);
		if (!options.silent) this.emit("Replaced active path");
	}

	mergePath(messages: TMessage[], options: { silent?: boolean } = {}) {
		this.#tree.reconcilePath(messages);
		if (!options.silent) this.emit("Reconciled active path");
	}

	mergeRunPath(messages: TMessage[]) {
		this.#tree.reconcilePath(messages, { moveCursor: false });
	}

	restore(
		snapshot: MessageTreeSnapshot<TMessage>,
		options: { silent?: boolean } = {},
	) {
		this.assertCanResetTree();
		this.clearRunState();
		this.#tree.restore(snapshot);
		if (!options.silent) this.emit("Restored tree");
	}

	setMessages(messages: TMessage[] | ((messages: TMessage[]) => TMessage[])) {
		const nextMessages =
			typeof messages === "function"
				? messages(this.#snapshot.messages)
				: messages;
		this.mergePath(nextMessages);
	}

	sendMessage = async (
		input?: SendMessageInput<TMessage>,
		options?: TreeSendOptions,
	) => {
		const run = await this.startRun({
			follow: options?.tree?.follow,
			from:
				options?.tree && "from" in options.tree
					? (options.tree.from ?? null)
					: undefined,
			message: input,
			request: options,
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
			if (!originMessage || originMessage.role !== "user") {
				throw new Error("Select a user message before starting a run");
			}
			this.assertCanStartRun(originMessage.id);
			return this.startAssistantForUser({
				assistantMessageId: this.reserveAssistantMessageId(
					options,
					originMessage.id,
				),
				follow,
				options,
				originCursorId,
				parentMessageId: this.#tree.getParentId(originMessage.id) ?? null,
				userMessageId: originMessage.id,
			});
		}

		const userMessage = await createUserMessageFromInput({
			fallbackId: getInputMessageId(input) ?? this.generateMessageId(),
			input,
		});
		const existingMessage = this.#tree.getMessage(userMessage.id);
		if (existingMessage && existingMessage.role !== "user") {
			throw new Error(`Message ${userMessage.id} is not a user message`);
		}
		this.assertCanStartRun(userMessage.id);
		const assistantMessageId = this.reserveAssistantMessageId(
			options,
			userMessage.id,
		);
		const attachmentId = existingMessage
			? (this.#tree.getParentId(userMessage.id) ?? null)
			: originCursorId;
		this.#tree.upsertMessage(userMessage, attachmentId);
		if (follow) this.#tree.setCursor(userMessage.id);

		return this.startAssistantForUser({
			assistantMessageId,
			follow,
			options,
			originCursorId,
			parentMessageId: attachmentId,
			userMessageId: userMessage.id,
		});
	};

	clearError = () => {
		const run = this.getSelectedRunRecord();
		if (run) {
			run.error = undefined;
			run.chat.clearError();
			this.emit("Cleared error");
		}
	};

	stop = () => this.getSelectedRunRecord()?.chat.stop() ?? Promise.resolve();

	stopAll() {
		return Promise.all(
			this.getActiveRunRecords().map((run) => run.chat.stop()),
		).then(() => undefined);
	}

	stopRun(runId: string) {
		return this.#runsById.get(runId)?.chat.stop() ?? Promise.resolve();
	}

	stopRunForMessage(messageId: string) {
		const run = this.getRunForMessage(messageId);
		return run ? this.stopRun(run.id) : Promise.resolve();
	}

	getRun(runId: string) {
		const run = this.#runsById.get(runId);
		return run ? this.toRunSnapshot(run) : undefined;
	}

	getRunForMessage(messageId: string) {
		const runs = Array.from(this.#runsById.values()).reverse();
		const run =
			runs.find(
				(candidate) => candidate.spec.assistantMessageId === messageId,
			) ??
			runs.find(
				(candidate) =>
					candidate.spec.userMessageId === messageId &&
					(candidate.status === "submitted" ||
						candidate.status === "streaming"),
			) ??
			runs.find((candidate) => candidate.spec.userMessageId === messageId);
		return run ? this.toRunSnapshot(run) : undefined;
	}

	setRunError(runId: string, error: Error | undefined) {
		const run = this.#runsById.get(runId);
		if (!run) return;
		run.error = error;
		run.status = error ? "error" : run.status;
		this.emit(error ? `Error in ${runId}` : "Cleared error");
		this.emitRunEvent(run, "run-updated");
	}

	setRunStatus(runId: string, status: ChatStatus) {
		const run = this.#runsById.get(runId);
		if (!run) return;
		run.status = status;
		this.emit(`${runId} is ${status}`);
		this.emitRunEvent(run, "run-updated");
	}

	finishRequest(runId: string, isAbort: boolean) {
		const run = this.#runsById.get(runId);
		if (run) run.aborted ||= isAbort;
		this.emit(isAbort ? `Stopping ${runId}` : `Received ${runId}`);
	}

	registerToolCall() {}

	indexMessageOwnership() {}

	private buildSnapshot(): ThreadStateSnapshot<TMessage> {
		const tree = this.#tree.getSnapshot();
		const runs = Array.from(this.#runsById.values()).map((run) =>
			this.toRunSnapshot(run),
		);
		const activeRuns = runs.filter(
			(run) => run.status === "submitted" || run.status === "streaming",
		);
		const selectedRun = this.getSelectedRunRecord();
		return {
			...tree,
			activeRuns,
			error: selectedRun?.error,
			lastEvent: this.#lastEvent,
			messages: this.#tree.getPath(),
			runs,
			status: selectedRun?.status ?? "ready",
			storeVersion: this.#storeVersion,
			treeStatus: this.resolveStatus(runs),
		};
	}

	private emit(event: string) {
		this.#lastEvent = event;
		this.#storeVersion += 1;
		this.#snapshot = this.buildSnapshot();
		for (const listener of this.#listeners) listener();
	}

	private assertCanStartRun(userMessageId: string) {
		const activeRuns = this.getActiveRunRecords();
		if (activeRuns.length >= this.#concurrency.maxActiveRuns) {
			throw new Error("Cannot start run: max active runs reached");
		}
		const activeFromMessage = activeRuns.filter(
			(run) => run.spec.userMessageId === userMessageId,
		).length;
		if (activeFromMessage >= this.#concurrency.maxActiveRunsPerMessage) {
			throw new Error(`Cannot start another run from ${userMessageId}`);
		}
	}

	private getActiveRunRecords() {
		return Array.from(this.#runsById.values()).filter(
			(run) => run.status === "submitted" || run.status === "streaming",
		);
	}

	private getSelectedRunRecord() {
		const pathIds = new Set(this.#tree.getPathIds());
		return Array.from(this.#runsById.values())
			.reverse()
			.find((run) => pathIds.has(run.spec.assistantMessageId));
	}

	private assertCanResetTree() {
		if (this.getActiveRunRecords().length > 0) {
			throw new Error("Cannot replace the tree while runs are active");
		}
	}

	private clearRunState() {
		this.#assistantStarted.clear();
		this.#runsById.clear();
	}

	private reserveAssistantMessageId(
		options: TreeSendOptions | undefined,
		userMessageId: string,
	) {
		const assistantMessageId =
			getAssistantMessageIdFromOptions(options) ?? this.generateMessageId();
		const existingMessage = this.#tree.getMessage(assistantMessageId);
		const isClaimablePlaceholder =
			existingMessage?.role === "assistant" &&
			existingMessage.parts.length === 0 &&
			this.#tree.getParentId(assistantMessageId) === userMessageId;
		if (
			assistantMessageId === userMessageId ||
			(existingMessage && !isClaimablePlaceholder) ||
			this.#runsById.has(assistantMessageId)
		) {
			throw new Error(
				`Assistant message id ${assistantMessageId} is unavailable`,
			);
		}
		return assistantMessageId;
	}

	private startAssistantForUser({
		assistantMessageId,
		follow,
		options,
		originCursorId,
		parentMessageId,
		userMessageId,
	}: Omit<ThreadRunSpec, "runId"> & { options?: TreeSendOptions }) {
		const spec: ThreadRunSpec = {
			assistantMessageId,
			follow,
			originCursorId,
			parentMessageId,
			runId: assistantMessageId,
			userMessageId,
		};
		if (!this.#tree.has(assistantMessageId)) {
			this.#tree.upsertMessage(
				createEmptyAssistantMessage<TMessage>(assistantMessageId),
				userMessageId,
			);
		}
		if (follow) this.#tree.setCursor(assistantMessageId);
		return this.startRunRequest(spec, options);
	}

	private startRunRequest(spec: ThreadRunSpec, options?: TreeSendOptions) {
		const chat = new ThreadRunChat(this, spec);
		const record: RunRecord<TMessage> = {
			aborted: false,
			chat,
			error: undefined,
			finished: Promise.resolve(),
			spec,
			status: "submitted",
		};
		this.#runsById.set(spec.runId, record);
		this.emit(`Started ${spec.runId}`);
		this.emitRunEvent(record, "run-started");
		const userMessage = this.#tree.getMessage(spec.userMessageId);
		const finished = chat
			.sendMessage(userMessage as CreateUIMessage<TMessage>, {
				...this.withRunRequestBody(spec, options),
			})
			.catch((error: unknown) => {
				this.setRunError(
					spec.runId,
					error instanceof Error ? error : new Error(String(error)),
				);
			})
			.finally(() => this.completeRun(spec.runId));
		record.finished = finished;
		return this.createRunHandle(record);
	}

	private completeRun(runId: string) {
		const run = this.#runsById.get(runId);
		if (!run) return;
		this.emit(
			run.aborted
				? `Stopped ${runId}`
				: run.error
					? `Failed ${runId}`
					: `Finished ${runId}`,
		);
		this.emitRunEvent(
			run,
			run.aborted ? "run-aborted" : run.error ? "run-failed" : "run-completed",
		);
	}

	private createRunHandle(run: RunRecord<TMessage>): ThreadRunHandle {
		return {
			assistantMessageId: run.spec.assistantMessageId,
			finished: run.finished,
			getSnapshot: () => this.getRun(run.spec.runId),
			id: run.spec.runId,
			stop: () => this.stopRun(run.spec.runId),
		};
	}

	private emitRunEvent(
		run: RunRecord<TMessage>,
		type:
			| "run-aborted"
			| "run-completed"
			| "run-failed"
			| "run-started"
			| "run-updated",
	) {
		this.onThreadEvent?.({ run: this.toRunSnapshot(run), type });
	}

	private toRunSnapshot(run: RunRecord<TMessage>): ThreadRun {
		return {
			assistantMessageId: run.spec.assistantMessageId,
			error: run.error,
			follow: run.spec.follow,
			id: run.spec.runId,
			originCursorId: run.spec.originCursorId,
			parentMessageId: run.spec.parentMessageId,
			status: run.status,
			userMessageId: run.spec.userMessageId,
		};
	}

	private resolveStatus(runs: ThreadRun[]) {
		if (runs.some((run) => run.status === "error")) return "error";
		if (runs.some((run) => run.status === "streaming")) return "streaming";
		if (runs.some((run) => run.status === "submitted")) return "submitted";
		return "ready";
	}

	private withRunRequestBody(
		spec: ThreadRunSpec,
		options: ChatRequestOptions | undefined,
	): ChatRequestOptions {
		return {
			...options,
			body: {
				...(options?.body ?? {}),
				assistantMessageId: spec.assistantMessageId,
				tree: {
					assistantMessageId: spec.assistantMessageId,
					cursorId: spec.assistantMessageId,
					originCursorId: spec.originCursorId,
					parentMessageId: spec.parentMessageId,
					pathIds: this.#tree.getPathIds(spec.assistantMessageId),
					userMessageId: spec.userMessageId,
				},
			},
		};
	}
}

export function createThreadChat<TMessage extends UIMessage = UIMessage>(
	options: ThreadChatOptions<TMessage> = {},
) {
	return new ThreadChat(options);
}
