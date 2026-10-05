/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/ai-elements/message"; "../components/message-vote-actions" dependency within this package instead of introducing an alias or barrel API. */
import React from "react";
import { createRoot } from "react-dom/client";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MessageActions } from "../components/ai-elements/message";
/* oxlint-enable sort-imports */
import { MessageVoteActions } from "../components/message-vote-actions";
/* oxlint-enable import/no-relative-parent-imports */

const states: {
  label: string;
  vote?: { isUpvoted: boolean };
  disabled?: boolean;
}[] = [
  { label: "Not rated" },
  { label: "Upvoted", vote: { isUpvoted: true } },
  { label: "Downvoted", vote: { isUpvoted: false } },
  { disabled: true, label: "Loading or saving" },
];
const root = document.querySelector("#fixture");
if (!root) {
  throw new Error("Missing fixture root");
}
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createRoot(root).render's required Promise and rejection contract. onVote resolves an immediately completed no-op vote for the static feedback fixture. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- * react-perf/jsx-no-new-function-as-prop (#557): createRoot(root).render creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-max-depth (#548): createRoot(root).render keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): createRoot(root).render accepts state; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
createRoot(root).render(
  <main className="mx-auto max-w-xl space-y-6 p-6">
    <h1>Shared ChatJS feedback controls</h1>
    {states.map((state) => (
      <section className="space-y-2" key={state.label}>
        <h2>{state.label}</h2>
        <MessageActions>
          <MessageVoteActions
            disabled={state.disabled}
            onVote={async () => {
              /* This static fixture does not submit a vote. */
            }}
            vote={state.vote}
          />
        </MessageActions>
      </section>
    ))}
  </main>
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
