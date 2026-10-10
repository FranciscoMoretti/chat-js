import type { ChatStatus, UIMessage } from "ai";
import type { ThreadConcurrency, ThreadRun } from "./types";
import type { ThreadRunChat, ThreadRunSpec } from "./ai-sdk-run-chat";
import { readRunSnapshots, toRunSnapshot } from "./run-snapshots";
import type { ReadonlyMessageValue } from "./message-utils";
import { RunMessageOwnership } from "./run-message-ownership";
import type { RunSnapshotReader } from "./run-snapshots";

const SIBLING_ORDER_STEP = 1;

interface RunIdentityReader {
  readonly spec: Readonly<ThreadRunSpec>;
  readonly status: ChatStatus;
}

interface RunRecord<TMessage extends UIMessage> {
  chat: ThreadRunChat<TMessage>;
  error: Error | undefined;
  finished: Promise<void>;
  spec: ThreadRunSpec;
  status: ChatStatus;
}

class RunRegistry<TMessage extends UIMessage> {
  readonly #concurrency: Required<ThreadConcurrency>;
  readonly #ownership = new RunMessageOwnership();
  readonly #runsById = new Map<string, RunRecord<TMessage>>();
  // oxlint-disable-next-line unicorn/no-null -- Preserve the serialized and selection contract: null means no selected run.
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
    // oxlint-disable-next-line unicorn/no-null -- Clear selection to the existing explicit null sentinel.
    this.#selectedRunId = null;
    this.#ownership.clear();
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
    const runId = this.#ownership.getForApproval(approvalId);

    if (typeof runId === "string" && runId !== "") {
      return this.#runsById.get(runId);
    }
    return globalThis.undefined;
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
    const runId = this.#ownership.getForToolCall(toolCallId);

    if (typeof runId === "string" && runId !== "") {
      return this.#runsById.get(runId);
    }
    return globalThis.undefined;
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
    return readRunSnapshots(this);
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
    message: {
      readonly parts: readonly ReadonlyMessageValue<
        UIMessage["parts"][number]
      >[];
    }
  ): void {
    this.#ownership.indexMessage(runId, message);
  }

  public isExplicitlySelected(runId: string): boolean {
    return this.#selectedRunId === runId;
  }

  public registerToolCall(runId: string, toolCallId: string): void {
    this.#ownership.registerToolCall(runId, toolCallId);
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
    return this.values().map((run: RunSnapshotReader) => toRunSnapshot(run));
  }

  public values(): RunRecord<TMessage>[] {
    return [...this.#runsById.values()];
  }
}
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (RunRegistry); the enabled import/no-default-export convention rejects the default-export alternative. */

export { RunRegistry };
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/no-named-export -- Keep the named type bindings (RunRecord); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { RunRecord };
/* oxlint-enable import/no-named-export */
