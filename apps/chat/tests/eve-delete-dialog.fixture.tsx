/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-delete-dialog" dependency within this package instead of introducing an alias or barrel API.
 */
import React from "react";
import { createRoot } from "react-dom/client";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveDeleteDialogView } from "../components/eve/eve-delete-dialog";
/* oxlint-enable sort-imports */
import type { EveDeletionPhase } from "../components/eve/eve-delete-dialog";
/* oxlint-enable import/no-relative-parent-imports */

const phases: EveDeletionPhase[] = [
  "confirm",
  "deleting",
  "pending",
  "unconfirmed",
  "checking",
  "unavailable",
  "not_started",
];
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
/* oxlint-disable react-perf/jsx-no-new-function-as-prop --
 * react-perf/jsx-no-new-function-as-prop (#557): createRoot(root).render creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 */
createRoot(root).render(
  phases.map((phase) => (
    <EveDeleteDialogView
      key={phase}
      onCheck={() => {
        /* This static fixture does not run the check action. */
      }}
      onClose={() => {
        /* This static fixture does not close the dialog. */
      }}
      onDelete={() => {
        /* This static fixture does not delete the conversation. */
      }}
      phase={phase}
      title={`Example conversation — ${phase}`}
    />
  ))
);
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
