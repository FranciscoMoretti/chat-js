"use client";

import { ResponseChoiceCards } from "../response-choice-cards";

export type EveResponseCardCandidate = {
  operationId: string;
  modelName: string;
  state: "bound" | "unresolved" | "waiting" | "rejected";
  status?:
    | "submitted"
    | "streaming"
    | "resuming"
    | "ready"
    | "error"
    | "awaiting-input";
  disabled?: boolean;
};

/** Controllers supply native status and handle navigation or recovery. */
export const EveResponseGroupCards = ({
  candidates,
  selectedOperationId,
  onSelect,
}: {
  candidates: readonly EveResponseCardCandidate[];
  selectedOperationId: string | null;
  onSelect: (operationId: string) => void;
}) => {
  if (candidates.length <= 1) {
    return null;
  }
  return (
    <ResponseChoiceCards
      slots={candidates.map((candidate) => {
        const selected = candidate.operationId === selectedOperationId;
        const loading =
          candidate.state === "bound" &&
          (candidate.status === "submitted" ||
            candidate.status === "streaming" ||
            candidate.status === "resuming");
        let statusLabel = "Open response";
        if (candidate.state === "unresolved") {
          statusLabel = "Needs retry";
        } else if (candidate.state === "waiting") {
          statusLabel = "Waiting";
        } else if (
          candidate.state === "rejected" ||
          candidate.status === "error"
        ) {
          statusLabel = "Failed";
        } else if (candidate.status === "awaiting-input") {
          statusLabel = "Needs input";
        } else if (loading) {
          statusLabel = "Generating...";
        } else if (candidate.status === "ready") {
          statusLabel = selected ? "Selected" : "Task completed";
        }
        return {
          disabled: candidate.disabled,
          handleSelect: () => onSelect(candidate.operationId),
          id: candidate.operationId,
          loading,
          modelName: candidate.modelName,
          selected,
          statusLabel,
        };
      })}
    />
  );
};
