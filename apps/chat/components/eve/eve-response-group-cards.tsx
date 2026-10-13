"use client";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { ResponseChoiceCards } from "../response-choice-cards";

export interface EveResponseCardCandidate {
  readonly operationId: string;
  readonly modelName: string;
  readonly state: "bound" | "unresolved" | "waiting" | "rejected" | "pending";
  readonly status?:
    | "submitted"
    | "streaming"
    | "resuming"
    | "ready"
    | "error"
    | "awaiting-input";
  readonly disabled?: boolean;
}

/** Controllers supply native status and handle navigation or recovery. */
export const EveResponseGroupCards = ({
  candidates,
  selectedOperationId,
  onSelect,
}: {
  readonly candidates: readonly EveResponseCardCandidate[];
  readonly selectedOperationId: string | null;
  readonly onSelect: (operationId: string) => void;
}): ReactJSX.Element | null => {
  if (candidates.length <= 1) {
    return null;
  }
  return (
    <ResponseChoiceCards
      slots={candidates.map((candidate: EveResponseCardCandidate) => {
        const selected = candidate.operationId === selectedOperationId;
        const loading =
          candidate.state === "pending" ||
          (candidate.state === "bound" &&
            (candidate.status === "submitted" ||
              candidate.status === "streaming" ||
              candidate.status === "resuming"));
        let statusLabel = "Open response";
        if (candidate.state === "pending") {
          statusLabel = "Generating...";
        } else if (candidate.state === "unresolved") {
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
          handleSelect: () => {
            onSelect(candidate.operationId);
          },
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
