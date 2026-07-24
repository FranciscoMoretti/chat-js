import { type ChatStatus, isToolUIPart, type UIMessage } from "ai";
import type { ThreadRunChat, ThreadRunSpec } from "./ai-sdk-run-chat";
import type { ThreadConcurrency, ThreadRun } from "./types";

export type RunRecord<TMessage extends UIMessage> = {
	chat: ThreadRunChat<TMessage>;
	error: Error | undefined;
	finished: Promise<void>;
	spec: ThreadRunSpec;
	status: ChatStatus;
};

export class RunRegistry<TMessage extends UIMessage> {
	readonly #concurrency: Required<ThreadConcurrency>;
	readonly #runIdByApprovalId = new Map<string, string>();
	readonly #runIdByToolCallId = new Map<string, string>();
	readonly #runsById = new Map<string, RunRecord<TMessage>>();
	#selectedRunId: string | null = null;

	constructor(concurrency: ThreadConcurrency = {}) {
		this.#concurrency = {
			maxActiveRuns: concurrency.maxActiveRuns ?? Number.POSITIVE_INFINITY,
			maxActiveRunsPerMessage:
				concurrency.maxActiveRunsPerMessage ?? Number.POSITIVE_INFINITY,
		};
	}

	add(record: RunRecord<TMessage>) {
		if (this.#runsById.has(record.spec.id)) {
			throw new Error(`Run ${record.spec.id} already exists`);
		}
		this.#runsById.set(record.spec.id, record);
	}

	assertCanStart(parentMessageId: string) {
		const activeRuns = this.getActive();
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

	clear() {
		this.#selectedRunId = null;
		this.#runIdByApprovalId.clear();
		this.#runIdByToolCallId.clear();
		this.#runsById.clear();
	}

	get(runId: string) {
		return this.#runsById.get(runId);
	}

	getActive() {
		return this.values().filter(
			(run) => run.status === "submitted" || run.status === "streaming",
		);
	}

	getForApproval(approvalId: string) {
		const runId = this.#runIdByApprovalId.get(approvalId);
		if (!runId) throw new Error(`No run owns tool approval ${approvalId}`);
		return this.require(runId);
	}

	getForMessage(messageId: string) {
		const runs = this.values().reverse();
		return (
			runs.find((candidate) => candidate.spec.messageId === messageId) ??
			runs.find(
				(candidate) =>
					candidate.spec.parentMessageId === messageId &&
					(candidate.status === "submitted" ||
						candidate.status === "streaming"),
			) ??
			runs.find((candidate) => candidate.spec.parentMessageId === messageId)
		);
	}

	getForToolCall(toolCallId: string) {
		const runId = this.#runIdByToolCallId.get(toolCallId);
		if (!runId) throw new Error(`No run owns tool call ${toolCallId}`);
		return this.require(runId);
	}

	getInsertionIndex({
		childIds,
		parentMessageId,
		siblingOrder,
	}: {
		childIds: string[];
		parentMessageId: string | null;
		siblingOrder: number;
	}) {
		const siblingOrderByMessageId = new Map<string, number>();
		for (const candidate of this.#runsById.values()) {
			if (
				candidate.spec.parentMessageId === parentMessageId &&
				candidate.spec.messageId
			) {
				siblingOrderByMessageId.set(
					candidate.spec.messageId,
					candidate.spec.siblingOrder,
				);
			}
		}
		return childIds.filter((childId) => {
			const order = siblingOrderByMessageId.get(childId);
			return order === undefined || order < siblingOrder;
		}).length;
	}

	getSnapshot() {
		const runs = this.snapshots();
		const activeRuns = runs.filter(
			(run) => run.status === "submitted" || run.status === "streaming",
		);
		let status: ChatStatus = "ready";
		if (activeRuns.some((run) => run.status === "streaming")) {
			status = "streaming";
		} else if (activeRuns.some((run) => run.status === "submitted")) {
			status = "submitted";
		}
		return { activeRuns, runs, status };
	}

	resolveSelected({
		cursorId,
		pathIds,
	}: {
		cursorId: string | null;
		pathIds: ReadonlySet<string>;
	}) {
		if (this.#selectedRunId) {
			const selectedRun = this.#runsById.get(this.#selectedRunId);
			if (selectedRun) return selectedRun;
		}

		const runs = this.values().reverse();
		const responseRun = runs.find(
			(run) =>
				run.spec.messageId !== undefined && pathIds.has(run.spec.messageId),
		);
		if (responseRun) return responseRun;
		if (!cursorId) return undefined;

		return (
			runs.find(
				(run) =>
					run.spec.parentMessageId === cursorId &&
					(run.status === "submitted" || run.status === "streaming"),
			) ?? runs.find((run) => run.spec.parentMessageId === cursorId)
		);
	}

	indexMessageOwnership(runId: string, message: TMessage) {
		const toolCallIds: string[] = [];
		const approvalIds: string[] = [];
		for (const part of message.parts) {
			if (!isToolUIPart(part)) continue;
			toolCallIds.push(part.toolCallId);
			if (part.approval) approvalIds.push(part.approval.id);
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

	isExplicitlySelected(runId: string) {
		return this.#selectedRunId === runId;
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

	require(runId: string) {
		const run = this.#runsById.get(runId);
		if (!run) throw new Error(`Unknown run ${runId}`);
		return run;
	}

	reserveId(generateId: () => string) {
		const runId = generateId();
		if (this.#runsById.has(runId)) {
			throw new Error(`Run ${runId} already exists`);
		}
		return runId;
	}

	reserveSiblingOrder(
		parentMessageId: string | null,
		existingChildrenCount: number,
	) {
		const existingMessageOrder = existingChildrenCount - 1;
		const runOrders = this.values()
			.filter((run) => run.spec.parentMessageId === parentMessageId)
			.map((run) => run.spec.siblingOrder);
		return Math.max(existingMessageOrder, ...runOrders) + 1;
	}

	select(runId: string | null) {
		this.#selectedRunId = runId;
	}

	setError(runId: string, error: Error | undefined) {
		const run = this.#runsById.get(runId);
		if (!run) return;
		run.error = error;
	}

	setStatus(runId: string, status: ChatStatus) {
		const run = this.#runsById.get(runId);
		if (run) run.status = status;
	}

	snapshots() {
		return this.values().map((run) => this.toSnapshot(run));
	}

	toSnapshot(run: RunRecord<TMessage>): ThreadRun {
		return {
			error: run.error,
			id: run.spec.id,
			status: run.status,
		};
	}

	values() {
		return Array.from(this.#runsById.values());
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
}
