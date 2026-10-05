"use client";
import React from "react";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable import/no-relative-parent-imports -- ../response-choice-cards import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { ResponseChoiceCards } from "../response-choice-cards";
/* oxlint-enable import/no-relative-parent-imports */

export interface EveResponseCardCandidate {
  operationId: string;
  modelName: string;
  state: "bound" | "unresolved" | "waiting" | "rejected" | "pending";
  status?:
    | "submitted"
    | "streaming"
    | "resuming"
    | "ready"
    | "error"
    | "awaiting-input";
  disabled?: boolean;
}
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-array-as-prop, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveResponseGroupCards: jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including candidate); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Controllers supply native status and handle navigation or recovery. */
export const EveResponseGroupCards = ({
  candidates,
  selectedOperationId,
  onSelect,
}: {
  candidates: readonly EveResponseCardCandidate[];
  selectedOperationId: string | null;
  onSelect: (operationId: string) => void;
}): ReactJSX.Element | null => {
  if (candidates.length <= 1) {
    return null;
  }
  return (
    <ResponseChoiceCards
      slots={candidates.map((candidate) => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-array-as-prop, typescript/prefer-readonly-parameter-types, unicorn/no-null */
