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
import type {
	MessageTreeSnapshot,
	ThreadChatOptions,
	ThreadConcurrency,
	ThreadRun,
	ThreadRunHandle,
	ThreadStartRunOptions,
	ThreadStateSnapshot,
	TreeSendOptions,
} from "./types";

type SendMessageInput<TMessage extends UIMessage> = Parameters<
	AbstractChat<TMessage>["sendMessage"]
>[0];

type RunRecord<TMessage extends UIMessage> = {
	chat: ThreadRunChat<TMessage>;
	error: Error | undefined;
	finished: Promise<void>;
	spec: ThreadRunSpec;
	status: ChatStatus;
};

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

	readonly #concurrency: Required<ThreadConcurrency>;
	readonly #listeners = new Set<() => void>();
	readonly #runIdByApprovalId = new Map<string, string>();
	readonly #runIdByToolCallId = new Map<string, string>();
	readonly #runsById = new Map<string, RunRecord<TMessage>>();
	readonly #tree: MessageTree<TMessage>;
	#selectedRunId: string | null = null;
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
			const run = this.getRunForApproval(response.id);
			await run.chat.addToolApprovalResponse(response);
		};

	addToolOutput: AbstractChat<TMessage>["addToolOutput"] = async (output) => {
		const run = this.getRunForToolCall(output.toolCallId);
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
		this.#selectedRunId = null;
		this.#tree.setCursor(messageId);
		this.emit();
	}

	setCursorToParentOf(messageId: string) {
		this.#selectedRunId = null;
		this.#tree.setCursorToParentOf(messageId);
		this.emit();
	}

	getRunPath(runId: string) {
		const run = this.getRunRecord(runId);
		return this.#tree.getPath(run.spec.messageId ?? run.spec.parentMessageId);
	}

	writeRunMessage(runId: string, message: TMessage) {
		const run = this.getRunRecord(runId);
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

		const siblingOrderByMessageId = new Map<string, number>();
		for (const candidate of this.#runsById.values()) {
			if (candidate.spec.messageId) {
				siblingOrderByMessageId.set(
					candidate.spec.messageId,
					candidate.spec.siblingOrder,
				);
			}
		}
		const insertionIndex = this.#tree
			.getChildren(run.spec.parentMessageId)
			.filter((child) => {
				const siblingOrder = siblingOrderByMessageId.get(child.id);
				return (
					siblingOrder === undefined || siblingOrder < run.spec.siblingOrder
				);
			}).length;
		this.#tree.upsertMessage(message, run.spec.parentMessageId, {
			index: insertionIndex,
		});
		this.indexMessageOwnership(runId, message);
		if (
			this.#selectedRunId === runId &&
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
			id: this.reserveRunId(),
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

	replacePath(messages: TMessage[], options: { silent?: boolean } = {}) {
		this.assertCanResetTree();
		this.clearRunState();
		this.#tree.replacePath(messages);
		if (!options.silent) this.emit();
	}

	mergePath(messages: TMessage[], options: { silent?: boolean } = {}) {
		this.#tree.reconcilePath(messages);
		if (!options.silent) this.emit();
	}

	mergeRunPath(messages: TMessage[]) {
		this.#tree.reconcilePath(messages, { moveCursor: false });
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
		await this.resumeRunRequest(this.getRunRecord(runId), options);
	};

	restore(
		snapshot: MessageTreeSnapshot<TMessage>,
		options: { silent?: boolean } = {},
	) {
		this.assertCanResetTree();
		this.clearRunState();
		this.#tree.restore(snapshot);
		if (!options.silent) this.emit();
	}

	setMessages(messages: TMessage[] | ((messages: TMessage[]) => TMessage[])) {
		const nextMessages =
			typeof messages === "function"
				? messages(this.#snapshot.messages)
				: messages;
		this.#selectedRunId = null;
		this.mergePath(nextMessages);
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
				id: this.reserveRunId(),
				options,
				parentMessageId: originMessage.id,
			});
		}

		const message = await createMessageFromInput({
			fallbackId: getInputMessageId(input) ?? this.generateMessageId(),
			input,
		});
		const existingMessage = this.#tree.getMessage(message.id);
		this.assertCanStartRun(message.id);
		const attachmentId = existingMessage
			? (this.#tree.getParentId(message.id) ?? null)
			: originCursorId;
		this.#tree.upsertMessage(message, attachmentId);
		if (follow) this.#tree.setCursor(message.id);

		return this.startRunFromParent({
			follow,
			id: this.reserveRunId(),
			options,
			parentMessageId: message.id,
		});
	};

	clearError = () => {
		const run = this.getSelectedRunRecord();
		if (run) {
			run.error = undefined;
			run.chat.clearError();
			this.emit();
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
			runs.find((candidate) => candidate.spec.messageId === messageId) ??
			runs.find(
				(candidate) =>
					candidate.spec.parentMessageId === messageId &&
					(candidate.status === "submitted" ||
						candidate.status === "streaming"),
			) ??
			runs.find((candidate) => candidate.spec.parentMessageId === messageId);
		return run ? this.toRunSnapshot(run) : undefined;
	}

	setRunError(runId: string, error: Error | undefined) {
		const run = this.#runsById.get(runId);
		if (!run) return;
		run.error = error;
		run.status = error ? "error" : run.status;
		this.emit();
	}

	setRunStatus(runId: string, status: ChatStatus) {
		const run = this.#runsById.get(runId);
		if (!run) return;
		run.status = status;
		this.emit();
	}

	registerToolCall(runId: string, toolCallId: string) {
		this.assertOwnershipAvailable(
			this.#runIdByToolCallId,
			toolCallId,
			runId,
			"tool call",
		);
		this.#runIdByToolCallId.set(toolCallId, runId);
	}

	indexMessageOwnership(runId: string, message: TMessage) {
		const toolCallIds: string[] = [];
		const approvalIds: string[] = [];
		for (const part of message.parts) {
			if ("toolCallId" in part && typeof part.toolCallId === "string") {
				toolCallIds.push(part.toolCallId);
			}
			if (
				"approval" in part &&
				part.approval &&
				typeof part.approval === "object" &&
				"id" in part.approval &&
				typeof part.approval.id === "string"
			) {
				approvalIds.push(part.approval.id);
			}
		}

		for (const toolCallId of toolCallIds) {
			this.assertOwnershipAvailable(
				this.#runIdByToolCallId,
				toolCallId,
				runId,
				"tool call",
			);
		}
		for (const approvalId of approvalIds) {
			this.assertOwnershipAvailable(
				this.#runIdByApprovalId,
				approvalId,
				runId,
				"tool approval",
			);
		}
		for (const toolCallId of toolCallIds) {
			this.#runIdByToolCallId.set(toolCallId, runId);
		}
		for (const approvalId of approvalIds) {
			this.#runIdByApprovalId.set(approvalId, runId);
		}
	}

	private buildSnapshot(): ThreadStateSnapshot<TMessage> {
		const tree = this.#tree.getSnapshot();
		const indexes = this.#tree.getIndexes();
		const runs = Array.from(this.#runsById.values()).map((run) =>
			this.toRunSnapshot(run),
		);
		const activeRuns = runs.filter(
			(run) => run.status === "submitted" || run.status === "streaming",
		);
		const selectedRun = this.getSelectedRunRecord();
		return {
			...tree,
			...indexes,
			activeRuns,
			error: selectedRun?.error,
			messages: this.#tree.getPath(),
			runs,
			status: selectedRun?.status ?? "ready",
			treeStatus: this.resolveStatus(runs),
		};
	}

	private emit() {
		this.#snapshot = this.buildSnapshot();
		for (const listener of this.#listeners) listener();
	}

	private assertCanStartRun(parentMessageId: string) {
		const activeRuns = this.getActiveRunRecords();
		if (activeRuns.length >= this.#concurrency.maxActiveRuns) {
			throw new Error("Cannot start run: max active runs reached");
		}
		const activeFromMessage = activeRuns.filter(
			(run) => run.spec.parentMessageId === parentMessageId,
		).length;
		if (activeFromMessage >= this.#concurrency.maxActiveRunsPerMessage) {
			throw new Error(`Cannot start another run from ${parentMessageId}`);
		}
	}

	private getActiveRunRecords() {
		return Array.from(this.#runsById.values()).filter(
			(run) => run.status === "submitted" || run.status === "streaming",
		);
	}

	private getSelectedRunRecord() {
		if (this.#selectedRunId) {
			const selectedRun = this.#runsById.get(this.#selectedRunId);
			if (selectedRun) return selectedRun;
		}
		const pathIds = new Set(this.#tree.getPathIds());
		const runs = Array.from(this.#runsById.values()).reverse();
		const responseRun = runs.find(
			(run) =>
				run.spec.messageId !== undefined && pathIds.has(run.spec.messageId),
		);
		if (responseRun) return responseRun;

		const cursorId = this.#tree.cursorId;
		if (!cursorId) return undefined;
		return (
			runs.find(
				(run) =>
					run.spec.parentMessageId === cursorId &&
					(run.status === "submitted" || run.status === "streaming"),
			) ?? runs.find((run) => run.spec.parentMessageId === cursorId)
		);
	}

	private getRunRecord(runId: string) {
		const run = this.#runsById.get(runId);
		if (!run) throw new Error(`Unknown run ${runId}`);
		return run;
	}

	private getRunForToolCall(toolCallId: string) {
		const runId = this.#runIdByToolCallId.get(toolCallId);
		if (!runId) throw new Error(`No run owns tool call ${toolCallId}`);
		return this.getRunRecord(runId);
	}

	private getRunForApproval(approvalId: string) {
		const runId = this.#runIdByApprovalId.get(approvalId);
		if (!runId) throw new Error(`No run owns tool approval ${approvalId}`);
		return this.getRunRecord(runId);
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
			id: this.reserveRunId(),
		};
		const record: RunRecord<TMessage> = {
			chat: new ThreadRunChat(this, spec),
			error: undefined,
			finished: Promise.resolve(),
			spec,
			status: "ready",
		};
		this.#runsById.set(spec.id, record);
		this.#selectedRunId = spec.id;
		this.indexMessageOwnership(spec.id, message);
		this.emit();
		return record;
	}

	private assertCanResetTree() {
		if (this.getActiveRunRecords().length > 0) {
			throw new Error("Cannot replace the tree while runs are active");
		}
	}

	private clearRunState() {
		this.#selectedRunId = null;
		this.#runIdByApprovalId.clear();
		this.#runIdByToolCallId.clear();
		this.#runsById.clear();
	}

	private assertOwnershipAvailable(
		owners: Map<string, string>,
		id: string,
		runId: string,
		label: string,
	) {
		const existingRunId = owners.get(id);
		if (existingRunId && existingRunId !== runId) {
			throw new Error(
				`${label} ${id} is already owned by run ${existingRunId}`,
			);
		}
	}

	private reserveRunId() {
		const runId = this.generateMessageId();
		if (this.#runsById.has(runId)) {
			throw new Error(`Run ${runId} already exists`);
		}
		return runId;
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
			siblingOrder: this.reserveSiblingOrder(parentMessageId),
		};
		if (follow) {
			this.#selectedRunId = id;
			this.#tree.setCursor(parentMessageId);
		}
		return this.startRunRequest(spec, options);
	}

	private reserveSiblingOrder(parentMessageId: string | null) {
		const existingMessageOrder =
			this.#tree.getChildren(parentMessageId).length - 1;
		const runOrders = Array.from(this.#runsById.values())
			.filter((run) => run.spec.parentMessageId === parentMessageId)
			.map((run) => run.spec.siblingOrder);
		return Math.max(existingMessageOrder, ...runOrders) + 1;
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
		this.#runsById.set(spec.id, record);
		this.emit();
		const finished = chat
			.start(options)
			.catch((error: unknown) => {
				this.setRunError(
					spec.id,
					error instanceof Error ? error : new Error(String(error)),
				);
			})
			.finally(() => this.emit());
		record.finished = finished;
		return this.createRunHandle(record);
	}

	private createRunHandle(run: RunRecord<TMessage>): ThreadRunHandle {
		return {
			finished: run.finished,
			id: run.spec.id,
			getSnapshot: () => this.getRun(run.spec.id),
			stop: () => run.chat.stop(),
		};
	}

	private async resumeRunRequest(
		run: RunRecord<TMessage>,
		options: ChatRequestOptions,
	) {
		run.error = undefined;
		const finished = run.chat.resumeStream(options).finally(() => this.emit());
		run.finished = finished;
		this.emit();
		await finished;
	}

	private toRunSnapshot(run: RunRecord<TMessage>): ThreadRun {
		return {
			error: run.error,
			id: run.spec.id,
			status: run.status,
		};
	}

	private resolveStatus(runs: ThreadRun[]) {
		if (runs.some((run) => run.status === "streaming")) return "streaming";
		if (runs.some((run) => run.status === "submitted")) return "submitted";
		if (runs.some((run) => run.status === "error")) return "error";
		return "ready";
	}
}

export function createThreadChat<TMessage extends UIMessage = UIMessage>(
	options: ThreadChatOptions<TMessage> = {},
) {
	return new ThreadChat(options);
}
