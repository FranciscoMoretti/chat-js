import { isToolUIPart } from "ai";
import type { ChatStatus, UIMessage } from "ai";

import type { ThreadRunChat, ThreadRunSpec } from "./ai-sdk-run-chat";
import type { ThreadConcurrency, ThreadRun } from "./types";

interface RunRecord<TMessage extends UIMessage> {
  chat: ThreadRunChat<TMessage>;
  error: Error | undefined;
  finished: Promise<void>;
  spec: ThreadRunSpec;
  status: ChatStatus;
}

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable eslint/no-continue -- Skipping an ineligible item here keeps the remaining per-item operation inside the same loop and cleanup scope. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- The registry retains owned RunRecord instances and mutates their error/status fields; reader-only insertion/selection inputs and ownership maps use readonly views. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
class RunRegistry<TMessage extends UIMessage> {
  readonly #concurrency: Required<ThreadConcurrency>;
  readonly #runIdByApprovalId = new Map<string, string>();
  readonly #runIdByToolCallId = new Map<string, string>();
  readonly #runsById = new Map<string, RunRecord<TMessage>>();
  #selectedRunId: string | null = null;

  public constructor(concurrency: ThreadConcurrency = {}) {
    this.#concurrency = {
      maxActiveRuns: concurrency.maxActiveRuns ?? Number.POSITIVE_INFINITY,
      maxActiveRunsPerMessage:
        concurrency.maxActiveRunsPerMessage ?? Number.POSITIVE_INFINITY,
    };
  }

  public add(record: RunRecord<TMessage>): void {
    if (this.#runsById.has(record.spec.id)) {
      throw new Error(`Run ${record.spec.id} already exists`);
    }
    this.#runsById.set(record.spec.id, record);
  }

  public assertHasCapacity(parentMessageId: string | null): void {
    const activeRuns = this.getActive();
    if (activeRuns.length >= this.#concurrency.maxActiveRuns) {
      throw new Error("Cannot start run: max active runs reached");
    }
    const activeFromMessage = activeRuns.filter(
      (run): boolean => run.spec.parentMessageId === parentMessageId
    ).length;
    if (activeFromMessage >= this.#concurrency.maxActiveRunsPerMessage) {
      throw new Error(`Cannot start another run from ${parentMessageId}`);
    }
  }

  public clear(): void {
    this.#selectedRunId = null;
    this.#runIdByApprovalId.clear();
    this.#runIdByToolCallId.clear();
    this.#runsById.clear();
  }

  public get(runId: string): RunRecord<TMessage> | undefined {
    return this.#runsById.get(runId);
  }

  public getActive(): RunRecord<TMessage>[] {
    return this.values().filter(
      (run): boolean => run.status === "submitted" || run.status === "streaming"
    );
  }

  public findForApproval(approvalId: string): RunRecord<TMessage> | undefined {
    const runId = this.#runIdByApprovalId.get(approvalId);
    return typeof runId === "string" && runId !== ""
      ? this.#runsById.get(runId)
      : undefined;
  }

  public getForMessage(messageId: string): RunRecord<TMessage> | undefined {
    const runs = this.values().toReversed();
    return (
      runs.find(
        (candidate): boolean => candidate.spec.messageId === messageId
      ) ??
      runs.find(
        (candidate): boolean =>
          candidate.spec.parentMessageId === messageId &&
          (candidate.status === "submitted" || candidate.status === "streaming")
      ) ??
      runs.find(
        (candidate): boolean => candidate.spec.parentMessageId === messageId
      )
    );
  }

  public findForToolCall(toolCallId: string): RunRecord<TMessage> | undefined {
    const runId = this.#runIdByToolCallId.get(toolCallId);
    return typeof runId === "string" && runId !== ""
      ? this.#runsById.get(runId)
      : undefined;
  }

  public getForResponseMessage(
    messageId: string
  ): RunRecord<TMessage> | undefined {
    return this.values()
      .toReversed()
      .find((candidate): boolean => candidate.spec.messageId === messageId);
  }

  public getInsertionIndex({
    childIds,
    parentMessageId,
    siblingOrder,
  }: {
    readonly childIds: readonly string[];
    readonly parentMessageId: string | null;
    readonly siblingOrder: number;
  }): number {
    const siblingOrderByMessageId = new Map<string, number>();
    for (const candidate of this.#runsById.values()) {
      if (
        candidate.spec.parentMessageId === parentMessageId &&
        typeof candidate.spec.messageId === "string" &&
        candidate.spec.messageId !== ""
      ) {
        siblingOrderByMessageId.set(
          candidate.spec.messageId,
          candidate.spec.siblingOrder
        );
      }
    }
    return childIds.filter((childId): boolean => {
      const order = siblingOrderByMessageId.get(childId);
      return order === undefined || order < siblingOrder;
    }).length;
  }

  public getSnapshot(): {
    activeRuns: ThreadRun[];
    runs: ThreadRun[];
    status: "submitted" | "streaming" | "ready";
  } {
    const runs = this.snapshots();
    const activeRuns = runs.filter(
      (run): boolean => run.status === "submitted" || run.status === "streaming"
    );
    let status: ChatStatus = "ready";
    if (activeRuns.some((run): boolean => run.status === "streaming")) {
      status = "streaming";
    } else if (activeRuns.some((run): boolean => run.status === "submitted")) {
      status = "submitted";
    }
    return { activeRuns, runs, status };
  }

  public resolveSelected({
    cursorId,
    pathIds,
  }: {
    readonly cursorId: string | null;
    readonly pathIds: ReadonlySet<string>;
  }): RunRecord<TMessage> | undefined {
    if (this.#selectedRunId) {
      const selectedRun = this.#runsById.get(this.#selectedRunId);
      if (selectedRun) {
        return selectedRun;
      }
    }

    const runs = this.values().toReversed();
    const responseRun = runs.find(
      (run): boolean =>
        run.spec.messageId !== undefined && pathIds.has(run.spec.messageId)
    );
    if (responseRun) {
      return responseRun;
    }
    if (!(typeof cursorId === "string" && cursorId !== "")) {
      // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
      return;
    }

    return (
      runs.find(
        (run): boolean =>
          run.spec.parentMessageId === cursorId &&
          (run.status === "submitted" || run.status === "streaming")
      ) ?? runs.find((run): boolean => run.spec.parentMessageId === cursorId)
    );
  }

  public indexMessageOwnership(runId: string, message: TMessage): void {
    const toolCallIds: string[] = [];
    const approvalIds: string[] = [];
    for (const part of message.parts) {
      if (!isToolUIPart(part)) {
        continue;
      }
      toolCallIds.push(part.toolCallId);
      if (part.approval) {
        approvalIds.push(part.approval.id);
      }
    }

    for (const toolCallId of toolCallIds) {
      RunRegistry.assertOwnershipAvailable(
        this.#runIdByToolCallId,
        toolCallId,
        runId,
        "tool call"
      );
    }
    for (const approvalId of approvalIds) {
      RunRegistry.assertOwnershipAvailable(
        this.#runIdByApprovalId,
        approvalId,
        runId,
        "tool approval"
      );
    }
    for (const toolCallId of toolCallIds) {
      this.#runIdByToolCallId.set(toolCallId, runId);
    }
    for (const approvalId of approvalIds) {
      this.#runIdByApprovalId.set(approvalId, runId);
    }
  }

  public isExplicitlySelected(runId: string): boolean {
    return this.#selectedRunId === runId;
  }

  public registerToolCall(runId: string, toolCallId: string): void {
    RunRegistry.assertOwnershipAvailable(
      this.#runIdByToolCallId,
      toolCallId,
      runId,
      "tool call"
    );
    this.#runIdByToolCallId.set(toolCallId, runId);
  }

  public require(runId: string): RunRecord<TMessage> {
    const run = this.#runsById.get(runId);
    if (!run) {
      throw new Error(`Unknown run ${runId}`);
    }
    return run;
  }

  public reserveId(generateId: () => string): string {
    const runId = generateId();
    if (this.#runsById.has(runId)) {
      throw new Error(`Run ${runId} already exists`);
    }
    return runId;
  }

  public reserveSiblingOrder(
    parentMessageId: string | null,
    existingChildrenCount: number
  ): number {
    const existingMessageOrder = existingChildrenCount - 1;
    const runOrders = this.values()
      .filter((run): boolean => run.spec.parentMessageId === parentMessageId)
      .map((run): number => run.spec.siblingOrder);
    return Math.max(existingMessageOrder, ...runOrders) + 1;
  }

  public select(runId: string | null): void {
    this.#selectedRunId = runId;
  }

  public setError(runId: string, error: Error | undefined): void {
    const run = this.#runsById.get(runId);
    if (!run) {
      return;
    }
    run.error = error;
  }

  public setStatus(runId: string, status: ChatStatus): void {
    const run = this.#runsById.get(runId);
    if (run) {
      run.status = status;
    }
  }

  public snapshots(): ThreadRun[] {
    return this.values().map((run) => RunRegistry.toSnapshot(run));
  }

  public static toSnapshot<TMessage extends UIMessage>(
    run: RunRecord<TMessage>
  ): ThreadRun {
    return {
      error: run.error,
      id: run.spec.id,
      status: run.status,
    };
  }

  public values(): RunRecord<TMessage>[] {
    return [...this.#runsById.values()];
  }

  private static assertOwnershipAvailable(
    owners: ReadonlyMap<string, string>,
    id: string,
    runId: string,
    label: string
  ): void {
    const existingRunId = owners.get(id);
    if (
      typeof existingRunId === "string" &&
      existingRunId !== "" &&
      existingRunId !== runId
    ) {
      throw new Error(
        `${label} ${id} is already owned by run ${existingRunId}`
      );
    }
  }
}
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-params */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-continue */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */

export { RunRegistry };

export type { RunRecord };
