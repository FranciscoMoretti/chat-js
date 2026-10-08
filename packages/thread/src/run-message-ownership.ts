import type { ReadonlyMessageValue } from "./message-utils";
import type { UIMessage } from "ai";

type OwnershipPart = ReadonlyMessageValue<UIMessage["parts"][number]>;
type OwnershipToolPart = Extract<
  OwnershipPart,
  { readonly type: `tool-${string}` | "dynamic-tool" }
>;

const isOwnershipToolPart = (part: OwnershipPart): part is OwnershipToolPart =>
  part.type.startsWith("tool-") || part.type === "dynamic-tool";

class RunMessageOwnership {
  readonly #runIdByApprovalId = new Map<string, string>();
  readonly #runIdByToolCallId = new Map<string, string>();

  public clear(): void {
    this.#runIdByApprovalId.clear();
    this.#runIdByToolCallId.clear();
  }

  public getForApproval(approvalId: string): string | undefined {
    return this.#runIdByApprovalId.get(approvalId);
  }

  public getForToolCall(toolCallId: string): string | undefined {
    return this.#runIdByToolCallId.get(toolCallId);
  }

  public indexMessage(
    runId: string,
    message: { readonly parts: readonly OwnershipPart[] }
  ): void {
    const { approvalIds, toolCallIds } =
      RunMessageOwnership.collectMessageOwnership(message);

    for (const toolCallId of toolCallIds) {
      RunMessageOwnership.assertOwnershipAvailable({
        id: toolCallId,
        label: "tool call",
        owners: this.#runIdByToolCallId,
        runId,
      });
    }
    for (const approvalId of approvalIds) {
      RunMessageOwnership.assertOwnershipAvailable({
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

  public registerToolCall(runId: string, toolCallId: string): void {
    RunMessageOwnership.assertOwnershipAvailable({
      id: toolCallId,
      label: "tool call",
      owners: this.#runIdByToolCallId,
      runId,
    });
    this.#runIdByToolCallId.set(toolCallId, runId);
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

/* oxlint-disable import/prefer-default-export, import/no-named-export -- This internal ownership module uses the package's named bindings; the enforced no-default-export convention rejects a default export. */
export { RunMessageOwnership };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
