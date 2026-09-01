import type { ChatStatus } from "ai";

export type ParallelResponseLifecycle =
  | "queued"
  | "generating"
  | "complete"
  | "stopped"
  | "error";

interface ParallelResponseStatusMessage {
  metadata: {
    activeStreamId: string | null;
  };
}

export function getParallelResponseLifecycle(
  message: ParallelResponseStatusMessage | null,
  runStatus?: ChatStatus
): ParallelResponseLifecycle {
  if (!message) {
    if (runStatus === "error") {
      return "error";
    }
    if (runStatus === "ready") {
      return "stopped";
    }
    return runStatus === "streaming" ? "generating" : "queued";
  }
  if (message.metadata.activeStreamId?.startsWith("pending:")) {
    return "queued";
  }
  if (message.metadata.activeStreamId !== null) {
    return "generating";
  }
  return "complete";
}

export function getStatusLabel(
  isSelected: boolean,
  lifecycle: ParallelResponseLifecycle
): string {
  if (lifecycle !== "complete") {
    if (lifecycle === "stopped") {
      return "Stopped";
    }
    if (lifecycle === "error") {
      return "Failed";
    }
    return "Generating...";
  }
  return isSelected ? "Selected" : "Task completed";
}

export function getResponseAwareStatus(
  status: ChatStatus,
  message: ParallelResponseStatusMessage | null
): ChatStatus {
  const activeStreamId = message?.metadata.activeStreamId;
  if (!activeStreamId || status !== "ready") {
    return status;
  }

  return activeStreamId.startsWith("pending:") ? "submitted" : "streaming";
}
