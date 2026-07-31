import {
	type AbstractChat,
	type ChatInit,
	type ChatRequestOptions,
	type ChatStatus,
	type ChatTransport,
	convertFileListToFileUIParts,
	DefaultChatTransport,
	generateId,
	isToolUIPart,
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
	ThreadConcurrency,
	ThreadRunHandle,
	ThreadStartRunOptions,
	ThreadState,
	ThreadStateSnapshot,
	TreeSendOptions,
} from "./types";

type AbstractThreadOptions<TMessage extends UIMessage> = Omit<
	ChatInit<TMessage>,
	"messages"
> & {
	concurrency?: ThreadConcurrency;
	state: ThreadState<TMessage>;
};

const ownedThreadStates = new WeakSet<object>();

type SendMessageInput<TMessage extends UIMessage> = Parameters<
	AbstractChat<TMessage>["sendMessage"]
>[0];

function getInputMessageId<TMessage extends UIMessage>(
	input: NonNullable<SendMessageInput<TMessage>>,
) {
	return "id" in input ? (input.id ?? input.messageId) : input.messageId;
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
	const metadata = input.metadata;
	if ("text" in input || "files" in input) {
		const fileParts = Array.isArray(input.files)
			? input.files
			: await convertFileListToFileUIParts(input.files);
		return specializeMessage<TMessage>({
			id: messageId,
			metadata,
			parts: [
				...fileParts,
				...("text" in input && input.text != null
					? [{ text: input.text, type: "text" as const }]
					: []),
			],
			role: "user",
		});
	}
	return specializeMessage<TMessage>({
		...input,
		id: messageId,
		metadata,
		role: input.role ?? "user",
	});
}

export abstract class AbstractThread<TMessage extends UIMessage = UIMessage> {
	readonly id: string;
	readonly dataPartSchemas: AbstractThreadOptions<TMessage>["dataPartSchemas"];
	readonly generateMessageId: NonNullable<
		AbstractThreadOptions<TMessage>["generateId"]
	>;
	readonly messageMetadataSchema: AbstractThreadOptions<TMessage>["messageMetadataSchema"];
	onData: AbstractThreadOptions<TMessage>["onData"];
	onError: AbstractThreadOptions<TMessage>["onError"];
	onFinish: AbstractThreadOptions<TMessage>["onFinish"];
	onToolCall: AbstractThreadOptions<TMessage>["onToolCall"];
	sendAutomaticallyWhen: AbstractThreadOptions<TMessage>["sendAutomaticallyWhen"];
	transport: ChatTransport<TMessage>;

	readonly #runHost: ThreadRunHost<TMessage>;
	readonly #runs: RunRegistry<TMessage>;
	readonly #state: ThreadState<TMessage>;

	protected constructor(options: AbstractThreadOptions<TMessage>) {
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
		this.#state = options.state;
		this.#runHost = this.createRunHost();
		if (ownedThreadStates.has(options.state)) {
			throw new Error(
				"ThreadState is already attached to another AbstractThread",
			);
		}
		ownedThreadStates.add(options.state);
		try {
			this.publish();
		} catch (error) {
			ownedThreadStates.delete(options.state);
			throw error;
		}
	}

	getSnapshot = () => this.#state.getSnapshot();

	subscribe = (listener: () => void) => this.#state.subscribe(listener);

	addMessage(message: TMessage, parentId: string | null) {
		this.upsertMessage(message, parentId);
	}

	addToolApprovalResponse: AbstractChat<TMessage>["addToolApprovalResponse"] =
		async (response) => {
			const run = this.getOrCreateRunForApproval(response.id);
			await run.chat.addToolApprovalResponse(response);
		};

	addToolOutput: AbstractChat<TMessage>["addToolOutput"] = async (output) => {
		const run = this.getOrCreateRunForToolCall(output.toolCallId);
		await run.chat.addToolOutput(output);
	};

	addToolResult: AbstractChat<TMessage>["addToolResult"] = this.addToolOutput;

	getTreeSnapshot() {
		return this.readTree((tree) => tree.getSnapshot());
	}

	getChildren(messageId: string | null) {
		return this.readTree((tree) => tree.getChildren(messageId));
	}

	getLeaves(messageId: string | null = null) {
		return this.readTree((tree) => tree.getLeaves(messageId));
	}

	getMessage(messageId: string) {
		return this.readTree((tree) => tree.getMessage(messageId));
	}

	getParent(messageId: string) {
		return this.readTree((tree) => tree.getParent(messageId));
	}

	getPath(messageId?: string | null) {
		return this.readTree((tree) => tree.getPath(messageId));
	}

	getSiblings(messageId: string) {
		return this.readTree((tree) => tree.getSiblings(messageId));
	}

	setCursor(messageId: string | null) {
		this.#runs.select(null);
		this.updateTree((tree) => tree.setCursor(messageId));
	}

	setCursorToParentOf(messageId: string) {
		this.#runs.select(null);
		this.updateTree((tree) => tree.setCursorToParentOf(messageId));
	}

	private getMessagePath(messageId: string | null) {
		return this.readTree((tree) => tree.getPath(messageId));
	}

	private writeRunMessage(runId: string, message: TMessage) {
		const run = this.#runs.require(runId);
		this.updateTree((tree) => {
			const currentMessageId = run.spec.messageId;
			if (currentMessageId && currentMessageId !== message.id) {
				throw new Error(
					`Run ${runId} is already bound to message ${currentMessageId}`,
				);
			}
			if (!currentMessageId) {
				const existingMessage = tree.getMessage(message.id);
				if (existingMessage) {
					throw new Error(`Message ${message.id} already exists`);
				}
				run.spec.messageId = message.id;
			}

			const insertionIndex = this.#runs.getInsertionIndex({
				childIds: tree
					.getChildren(run.spec.parentMessageId)
					.map((child) => child.id),
				parentMessageId: run.spec.parentMessageId,
				siblingOrder: run.spec.siblingOrder,
			});
			tree.upsertMessage(message, run.spec.parentMessageId, {
				index: insertionIndex,
			});
			this.indexMessageOwnership(runId, message);
			if (
				this.#runs.isExplicitlySelected(runId) &&
				tree.cursorId === run.spec.initialPathMessageId
			) {
				tree.setCursor(message.id);
			}
		});
	}

	regenerate: AbstractChat<TMessage>["regenerate"] = async ({
		messageId,
		...options
	} = {}) => {
		const { parentMessageId, target } = this.readTree((tree) => {
			const selectedTarget =
				messageId == null
					? tree.cursorId
						? tree.getMessage(tree.cursorId)
						: undefined
					: tree.getMessage(messageId);
			return {
				parentMessageId:
					selectedTarget == null
						? null
						: selectedTarget.role === "assistant"
							? (tree.getParentId(selectedTarget.id) ?? null)
							: selectedTarget.id,
				target: selectedTarget,
			};
		});
		if (!target) {
			throw new Error(`message ${messageId} not found`);
		}

		if (target.role === "assistant") {
			if (parentMessageId) {
				const parentMessage = this.getMessage(parentMessageId);
				if (!parentMessage) {
					throw new Error(`Unknown message ${parentMessageId}`);
				}
				if (parentMessage.role === "assistant") {
					// AI SDK regeneration currently reuses a trailing assistant instead
					// of creating a new response, which would mutate this shared parent.
					throw new Error(
						`Cannot regenerate assistant message ${target.id} because its parent ${parentMessage.id} is also an assistant`,
					);
				}
				this.assertCanGenerateFrom(parentMessage);
			} else {
				this.#runs.assertHasCapacity(null);
			}
		} else {
			this.assertCanGenerateFrom(target);
		}

		const spec: ThreadRunSpec = {
			id: this.#runs.reserveId(this.generateMessageId),
			initialPathMessageId: target.id,
			parentMessageId,
			siblingOrder: this.#runs.reserveSiblingOrder(
				parentMessageId,
				this.getChildren(parentMessageId).length,
			),
		};
		this.#runs.select(spec.id);
		this.updateTree((tree) => tree.setCursor(target.id));
		const run = this.startRunRequest(spec, (chat) =>
			chat.regenerateMessage(target.id, options),
		);
		await run.finished;
	};

	upsertMessage(message: TMessage, parentId: string | null) {
		this.updateTree((tree) => tree.upsertMessage(message, parentId));
	}

	removeMessage(messageId: string) {
		this.updateTree((tree) => tree.removeLeaf(messageId));
	}

	private updateRunPath(messages: TMessage[]) {
		this.updateTree((tree) => tree.updatePath(messages));
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

	restore(snapshot: MessageTreeSnapshot<TMessage>) {
		this.assertCanResetTree();
		this.#runs.clear();
		this.updateTree((tree) => tree.restore(snapshot));
	}

	setMessages(messages: TMessage[] | ((messages: TMessage[]) => TMessage[])) {
		const nextMessages =
			typeof messages === "function"
				? messages(this.getSnapshot().messages)
				: messages;
		this.#runs.select(null);
		this.updateTree((tree) => tree.setPath(nextMessages));
	}

	sendMessage = async (
		input?: SendMessageInput<TMessage>,
		options?: TreeSendOptions,
	) => {
		const { tree, ...request } = options ?? {};
		if (!input) {
			const cursorId =
				tree && "from" in tree
					? (tree.from ?? null)
					: this.getSnapshot().cursorId;
			const cursorMessage = cursorId ? this.getMessage(cursorId) : undefined;
			if (cursorMessage?.role === "assistant") {
				const run = this.continueAssistant({
					follow: tree?.follow ?? cursorId === this.getSnapshot().cursorId,
					messageId: cursorMessage.id,
					options: request,
				});
				await run.finished;
				return;
			}
		}
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
		const { cursorId, originMessage } = this.readTree((tree) => {
			const originCursorId = from === undefined ? tree.cursorId : from;
			return {
				cursorId: originCursorId,
				originMessage: originCursorId
					? tree.getMessage(originCursorId)
					: undefined,
			};
		});
		if (cursorId && !originMessage) {
			throw new Error(`Unknown message ${cursorId}`);
		}
		const activeCursorId = this.getSnapshot().cursorId;
		const follow = requestedFollow ?? cursorId === activeCursorId;

		if (!input) {
			if (!originMessage) {
				throw new Error("Select a message before starting a run");
			}
			this.assertCanGenerateFrom(originMessage);
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
		if (message.role === "assistant") {
			return this.startAssistantMessage({
				follow,
				message,
				options,
				parentMessageId: cursorId,
			});
		}
		this.assertCanGenerateFrom(message);
		this.updateTree((tree) => {
			const existingMessage = tree.getMessage(message.id);
			const attachmentId = existingMessage
				? (tree.getParentId(message.id) ?? null)
				: cursorId;
			tree.upsertMessage(message, attachmentId);
			if (follow) tree.setCursor(message.id);
		});

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

	private setRunError(runId: string, error: Error | undefined) {
		this.#runs.setError(runId, error);
		this.publish();
	}

	private setRunStatus(runId: string, status: ChatStatus) {
		this.#runs.setStatus(runId, status);
		this.publish();
	}

	private registerToolCall(runId: string, toolCallId: string) {
		this.#runs.registerToolCall(runId, toolCallId);
	}

	private indexMessageOwnership(runId: string, message: TMessage) {
		this.#runs.indexMessageOwnership(runId, message);
	}

	private buildSnapshot(
		tree: MessageTree<TMessage>,
	): ThreadStateSnapshot<TMessage> {
		const treeSnapshot = tree.getSnapshot();
		const indexes = tree.getIndexes();
		const runSnapshot = this.#runs.getSnapshot();
		const selectedRun = this.getSelectedRunRecord(tree);
		return {
			...treeSnapshot,
			...indexes,
			activeRuns: runSnapshot.activeRuns,
			error: selectedRun?.error,
			messages: tree.getPath(),
			runs: runSnapshot.runs,
			status: selectedRun?.status ?? "ready",
			treeStatus: runSnapshot.status,
		};
	}

	private createTree(snapshot = this.#state.getSnapshot()) {
		return new MessageTree<TMessage>({ snapshot });
	}

	private createRunHost(): ThreadRunHost<TMessage> {
		const thread = this;
		return {
			get dataPartSchemas() {
				return thread.dataPartSchemas;
			},
			generateMessageId: () => thread.generateMessageId(),
			getMessagePath: (messageId) => thread.getMessagePath(messageId),
			get id() {
				return thread.id;
			},
			get messageMetadataSchema() {
				return thread.messageMetadataSchema;
			},
			get onData() {
				return thread.onData;
			},
			set onData(callback) {
				thread.onData = callback;
			},
			get onError() {
				return thread.onError;
			},
			set onError(callback) {
				thread.onError = callback;
			},
			get onFinish() {
				return thread.onFinish;
			},
			set onFinish(callback) {
				thread.onFinish = callback;
			},
			get onToolCall() {
				return thread.onToolCall;
			},
			set onToolCall(callback) {
				thread.onToolCall = callback;
			},
			registerToolCall: (runId, toolCallId) =>
				thread.registerToolCall(runId, toolCallId),
			removeMessage: (messageId) => thread.removeMessage(messageId),
			get sendAutomaticallyWhen() {
				return thread.sendAutomaticallyWhen;
			},
			set sendAutomaticallyWhen(callback) {
				thread.sendAutomaticallyWhen = callback;
			},
			setRunError: (runId, error) => thread.setRunError(runId, error),
			setRunStatus: (runId, status) => thread.setRunStatus(runId, status),
			get transport() {
				return thread.transport;
			},
			set transport(transport) {
				thread.transport = transport;
			},
			updateRunPath: (messages) => thread.updateRunPath(messages),
			writeRunMessage: (runId, message) =>
				thread.writeRunMessage(runId, message),
		};
	}

	private publish() {
		this.updateState((snapshot) =>
			this.buildSnapshot(this.createTree(snapshot)),
		);
	}

	private readTree<TResult>(
		reader: (tree: MessageTree<TMessage>) => TResult,
	): TResult {
		return reader(this.createTree());
	}

	private updateTree<TResult>(
		updater: (tree: MessageTree<TMessage>) => TResult,
	): TResult {
		const completed: Array<{ value: TResult }> = [];
		this.updateState((snapshot) => {
			const tree = this.createTree(snapshot);
			const value = updater(tree);
			completed.push({ value });
			return this.buildSnapshot(tree);
		});
		const [result] = completed;
		if (!result) {
			throw new Error("ThreadState update did not complete");
		}
		return result.value;
	}

	private updateState(
		updater: (
			snapshot: ThreadStateSnapshot<TMessage>,
		) => ThreadStateSnapshot<TMessage>,
	) {
		let calls = 0;
		this.#state.update((snapshot) => {
			calls += 1;
			return updater(snapshot);
		});
		if (calls !== 1) {
			throw new Error(
				"ThreadState.update must invoke its updater exactly once and synchronously",
			);
		}
	}

	private assertCanGenerateFrom(parentMessage: TMessage) {
		this.assertValidRunParent(parentMessage);
		this.#runs.assertHasCapacity(parentMessage.id);
	}

	private assertValidRunParent(message: TMessage) {
		if (message.role === "assistant") {
			throw new Error(
				`Cannot start a new run directly from assistant message ${message.id}; attach an input message first`,
			);
		}
	}

	private getSelectedRunRecord(tree = this.createTree()) {
		return this.#runs.resolveSelected({
			cursorId: tree.cursorId,
			pathIds: new Set(tree.getPathIds()),
		});
	}

	private findAssistantOwningPart({
		id,
		label,
		matches,
	}: {
		id: string;
		label: string;
		matches: (part: TMessage["parts"][number]) => boolean;
	}) {
		let owner: TMessage | undefined;
		for (const { message } of this.getTreeSnapshot().nodes) {
			if (message.role !== "assistant" || !message.parts.some(matches)) {
				continue;
			}
			if (owner && owner.id !== message.id) {
				throw new Error(
					`${label} ${id} appears in more than one assistant message`,
				);
			}
			owner = message;
		}
		return owner;
	}

	private getOrCreateRunForApproval(approvalId: string) {
		const existing = this.#runs.findForApproval(approvalId);
		if (existing) return existing;
		const owner = this.findAssistantOwningPart({
			id: approvalId,
			label: "Tool approval",
			matches: (part) => isToolUIPart(part) && part.approval?.id === approvalId,
		});
		if (!owner) {
			throw new Error(`No run owns tool approval ${approvalId}`);
		}
		const run = this.createRunForAssistant(owner.id);
		if (!run) {
			throw new Error(`Assistant message ${owner.id} cannot own a run`);
		}
		return run;
	}

	private getOrCreateRunForToolCall(toolCallId: string) {
		const existing = this.#runs.findForToolCall(toolCallId);
		if (existing) return existing;
		const owner = this.findAssistantOwningPart({
			id: toolCallId,
			label: "Tool call",
			matches: (part) => isToolUIPart(part) && part.toolCallId === toolCallId,
		});
		if (!owner) {
			throw new Error(`No run owns tool call ${toolCallId}`);
		}
		const run = this.createRunForAssistant(owner.id);
		if (!run) {
			throw new Error(`Assistant message ${owner.id} cannot own a run`);
		}
		return run;
	}

	private createRunForSelectedAssistant() {
		const tree = this.createTree();
		const messageId = tree.cursorId;
		if (!messageId) return;
		return this.createRunForAssistant(messageId, true);
	}

	private createRunForAssistant(messageId: string, select = false) {
		const existing = this.#runs.getForResponseMessage(messageId);
		if (existing) {
			if (select) this.#runs.select(existing.spec.id);
			return existing;
		}
		const tree = this.createTree();
		const message = tree.getMessage(messageId);
		if (!message || message.role !== "assistant") {
			return;
		}
		const parentMessageId = tree.getParentId(messageId) ?? null;
		const siblingOrder = tree
			.getChildren(parentMessageId)
			.findIndex((child) => child.id === messageId);
		if (siblingOrder === -1) {
			throw new Error(`Message ${messageId} is missing from its sibling order`);
		}

		const spec: ThreadRunSpec = {
			initialPathMessageId: messageId,
			messageId,
			parentMessageId,
			siblingOrder,
			id: this.#runs.reserveId(this.generateMessageId),
		};
		const record: RunRecord<TMessage> = {
			chat: new ThreadRunChat(this.#runHost, spec),
			error: undefined,
			finished: Promise.resolve(),
			spec,
			status: "ready",
		};
		this.#runs.add(record);
		if (select) this.#runs.select(spec.id);
		this.indexMessageOwnership(spec.id, message);
		this.publish();
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
	}: Omit<
		ThreadRunSpec,
		"initialPathMessageId" | "messageId" | "parentMessageId" | "siblingOrder"
	> & {
		follow: boolean;
		options?: ChatRequestOptions;
		parentMessageId: string;
	}) {
		const spec: ThreadRunSpec & { parentMessageId: string } = {
			id,
			initialPathMessageId: parentMessageId,
			parentMessageId,
			siblingOrder: this.#runs.reserveSiblingOrder(
				parentMessageId,
				this.getChildren(parentMessageId).length,
			),
		};
		if (follow) {
			this.#runs.select(id);
			this.updateTree((tree) => tree.setCursor(parentMessageId));
		}
		return this.startRunRequest(spec, (chat) => chat.start(options));
	}

	private startRunRequest(
		spec: ThreadRunSpec,
		start: (chat: ThreadRunChat<TMessage>) => Promise<void>,
	) {
		if (spec.parentMessageId && !this.getMessage(spec.parentMessageId)) {
			throw new Error(`Unknown message ${spec.parentMessageId}`);
		}
		const chat = new ThreadRunChat(this.#runHost, spec);
		const record: RunRecord<TMessage> = {
			chat,
			error: undefined,
			finished: Promise.resolve(),
			spec,
			status: "submitted",
		};
		this.#runs.add(record);
		this.publish();
		const finished = start(chat).finally(() => this.publish());
		record.finished = finished;
		return this.createRunHandle(record);
	}

	private continueAssistant({
		follow,
		messageId,
		options,
	}: {
		follow: boolean;
		messageId: string;
		options?: ChatRequestOptions;
	}) {
		const run = this.createRunForAssistant(messageId);
		if (!run) {
			throw new Error(`Message ${messageId} is not an assistant message`);
		}
		if (run.status === "submitted" || run.status === "streaming") {
			throw new Error(
				`Assistant message ${messageId} already has an active run`,
			);
		}
		this.#runs.assertHasCapacity(run.spec.parentMessageId);
		if (follow) {
			this.#runs.select(run.spec.id);
			this.updateTree((tree) => tree.setCursor(messageId));
		}
		const finished = run.chat.start(options).finally(() => this.publish());
		run.finished = finished;
		this.publish();
		return this.createRunHandle(run);
	}

	private startAssistantMessage({
		follow,
		message,
		options,
		parentMessageId,
	}: {
		follow: boolean;
		message: TMessage;
		options?: ChatRequestOptions;
		parentMessageId: string | null;
	}) {
		this.#runs.assertHasCapacity(parentMessageId);
		const spec: ThreadRunSpec = {
			id: this.#runs.reserveId(this.generateMessageId),
			initialPathMessageId: parentMessageId,
			messageId: message.id,
			parentMessageId,
			siblingOrder: this.#runs.reserveSiblingOrder(
				parentMessageId,
				this.getChildren(parentMessageId).length,
			),
		};
		if (follow) {
			this.#runs.select(spec.id);
		}
		return this.startRunRequest(spec, (chat) =>
			chat.startWithMessage(message, options),
		);
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
		this.#runs.assertHasCapacity(run.spec.parentMessageId);
		const finished = run.chat
			.resumeStream(options)
			.finally(() => this.publish());
		run.finished = finished;
		this.publish();
		await finished;
	}
}
