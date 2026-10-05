import type { ChatStatus, UIMessage } from "ai";

import type { ThreadRunChat, ThreadRunSpec } from "./ai-sdk-run-chat";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ThreadConcurrency, ThreadRun } from "./types";
/* oxlint-enable sort-imports */

const SIBLING_ORDER_STEP = 1;

type ReadonlyOwnershipValue<TValue> = TValue extends readonly unknown[]
  ? readonly ReadonlyOwnershipValue<TValue[number]>[]
  : TValue extends object
    ? { readonly [TKey in keyof TValue]: ReadonlyOwnershipValue<TValue[TKey]> }
    : TValue;

type OwnershipPart = ReadonlyOwnershipValue<UIMessage["parts"][number]>;
type OwnershipToolPart = Extract<
  OwnershipPart,
  { readonly type: `tool-${string}` | "dynamic-tool" }
>;

const isOwnershipToolPart = (part: OwnershipPart): part is OwnershipToolPart =>
  part.type.startsWith("tool-") || part.type === "dynamic-tool";

interface RunIdentityReader {
  readonly spec: Readonly<ThreadRunSpec>;
  readonly status: ChatStatus;
}

interface RunSnapshotReader {
  readonly error: Readonly<Error> | undefined;
  readonly spec: Readonly<Pick<ThreadRunSpec, "id">>;
  readonly status: ChatStatus;
}

interface RunRecord<TMessage extends UIMessage> {
  chat: ThreadRunChat<TMessage>;
  error: Error | undefined;
  finished: Promise<void>;
  spec: ThreadRunSpec;
  status: ChatStatus;
}

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
class RunRegistry<TMessage extends UIMessage> {
  readonly #concurrency: Required<ThreadConcurrency>;
  readonly #runIdByApprovalId = new Map<string, string>();
  readonly #runIdByToolCallId = new Map<string, string>();
  readonly #runsById = new Map<string, RunRecord<TMessage>>();
  #selectedRunId: string | null = null;

  public constructor(concurrency: Readonly<ThreadConcurrency> = {}) {
    this.#concurrency = {
      maxActiveRuns: concurrency.maxActiveRuns ?? Number.POSITIVE_INFINITY,
      maxActiveRunsPerMessage:
        concurrency.maxActiveRunsPerMessage ?? Number.POSITIVE_INFINITY,
    };
  }

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Keeps the live RunRecord and its SDK chat/spec references; the thread mutates spec.messageId and error/status after insertion.
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
      (run: RunIdentityReader): boolean =>
        run.spec.parentMessageId === parentMessageId
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
      (run: RunIdentityReader): boolean =>
        run.status === "submitted" || run.status === "streaming"
    );
  }

  public findForApproval(approvalId: string): RunRecord<TMessage> | undefined {
    const runId = this.#runIdByApprovalId.get(approvalId);
    return typeof runId === "string" && runId !== ""
      ? this.#runsById.get(runId)
      : globalThis.undefined;
  }

  public getForMessage(messageId: string): RunRecord<TMessage> | undefined {
    const runs = this.values().toReversed();
    return (
      runs.find(
        (candidate: RunIdentityReader): boolean =>
          candidate.spec.messageId === messageId
      ) ??
      runs.find(
        (candidate: RunIdentityReader): boolean =>
          candidate.spec.parentMessageId === messageId &&
          (candidate.status === "submitted" || candidate.status === "streaming")
      ) ??
      runs.find(
        (candidate: RunIdentityReader): boolean =>
          candidate.spec.parentMessageId === messageId
      )
    );
  }

  public findForToolCall(toolCallId: string): RunRecord<TMessage> | undefined {
    const runId = this.#runIdByToolCallId.get(toolCallId);
    return typeof runId === "string" && runId !== ""
      ? this.#runsById.get(runId)
      : globalThis.undefined;
  }

  public getForResponseMessage(
    messageId: string
  ): RunRecord<TMessage> | undefined {
    return this.values()
      .toReversed()
      .find(
        (candidate: RunIdentityReader): boolean =>
          candidate.spec.messageId === messageId
      );
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
      return order === globalThis.undefined || order < siblingOrder;
    }).length;
  }

  public getSnapshot(): {
    activeRuns: ThreadRun[];
    runs: ThreadRun[];
    status: "submitted" | "streaming" | "ready";
  } {
    const runs = this.snapshots();
    const activeRuns = runs.filter(
      (run: Readonly<Pick<ThreadRun, "status">>): boolean =>
        run.status === "submitted" || run.status === "streaming"
    );
    let status: ChatStatus = "ready";
    if (
      activeRuns.some(
        (run: Readonly<Pick<ThreadRun, "status">>): boolean =>
          run.status === "streaming"
      )
    ) {
      status = "streaming";
    } else if (
      activeRuns.some(
        (run: Readonly<Pick<ThreadRun, "status">>): boolean =>
          run.status === "submitted"
      )
    ) {
      status = "submitted";
    }
    return { activeRuns, runs, status };
  }

  public resolveSelected({
    cursorId,
    pathIds,
  }: {
    readonly cursorId: string | null;
    readonly pathIds: Readonly<Pick<ReadonlySet<string>, "has">>;
  }): RunRecord<TMessage> | undefined {
    const selectedRun = this.#runsById.get(this.#selectedRunId ?? "");
    if (
      typeof this.#selectedRunId === "string" &&
      this.#selectedRunId !== "" &&
      selectedRun
    ) {
      return selectedRun;
    }

    const runs = this.values().toReversed();
    const responseRun = runs.find(
      (run: RunIdentityReader): boolean =>
        run.spec.messageId !== globalThis.undefined &&
        pathIds.has(run.spec.messageId)
    );
    if (responseRun || !(typeof cursorId === "string" && cursorId !== "")) {
      return responseRun;
    }

    return (
      runs.find(
        (run: RunIdentityReader): boolean =>
          run.spec.parentMessageId === cursorId &&
          (run.status === "submitted" || run.status === "streaming")
      ) ??
      runs.find(
        (run: RunIdentityReader): boolean =>
          run.spec.parentMessageId === cursorId
      )
    );
  }

  public indexMessageOwnership(
    runId: string,
    message: { readonly parts: readonly OwnershipPart[] }
  ): void {
    const { approvalIds, toolCallIds } =
      RunRegistry.collectMessageOwnership(message);

    for (const toolCallId of toolCallIds) {
      RunRegistry.assertOwnershipAvailable({
        id: toolCallId,
        label: "tool call",
        owners: this.#runIdByToolCallId,
        runId,
      });
    }
    for (const approvalId of approvalIds) {
      RunRegistry.assertOwnershipAvailable({
        id: approvalId,
        label: "tool approval",
        owners: this.#runIdByApprovalId,
        runId,
      });
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
    RunRegistry.assertOwnershipAvailable({
      id: toolCallId,
      label: "tool call",
      owners: this.#runIdByToolCallId,
      runId,
    });
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
    const existingMessageOrder = existingChildrenCount - SIBLING_ORDER_STEP;
    const runOrders = this.values()
      .filter(
        (run: RunIdentityReader): boolean =>
          run.spec.parentMessageId === parentMessageId
      )
      .map((run: RunIdentityReader): number => run.spec.siblingOrder);
    return Math.max(existingMessageOrder, ...runOrders) + SIBLING_ORDER_STEP;
  }

  public select(runId: string | null): void {
    this.#selectedRunId = runId;
  }

  public setError(runId: string, error: Readonly<Error> | undefined): void {
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
    return this.values().map((run: RunSnapshotReader) =>
      RunRegistry.toSnapshot(run)
    );
  }

  public static toSnapshot(run: RunSnapshotReader): ThreadRun {
    return {
      error: run.error,
      id: run.spec.id,
      status: run.status,
    };
  }

  public values(): RunRecord<TMessage>[] {
    return [...this.#runsById.values()];
  }

  private static collectMessageOwnership(message: {
    readonly parts: readonly OwnershipPart[];
  }): { approvalIds: string[]; toolCallIds: string[] } {
    const toolCallIds: string[] = [];
    const approvalIds: string[] = [];
    for (const part of message.parts) {
      if (isOwnershipToolPart(part)) {
        toolCallIds.push(part.toolCallId);
        if (part.approval) {
          approvalIds.push(part.approval.id);
        }
      }
    }

    return { approvalIds, toolCallIds };
  }

  private static assertOwnershipAvailable({
    owners,
    id,
    runId,
    label,
  }: {
    readonly owners: Readonly<Pick<ReadonlyMap<string, string>, "get">>;
    readonly id: string;
    readonly runId: string;
    readonly label: string;
  }): void {
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
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-lines -- Keep this cohesive contract and its cases together; splitting it solely for a line quota would obscure shared setup or state transitions. */

export { RunRegistry };

export type { RunRecord };
