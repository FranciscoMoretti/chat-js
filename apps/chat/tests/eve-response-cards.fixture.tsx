/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-response-group-cards"; "../components/response-choice-cards" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The fixture preserves the production-compatible role markup used by its visual contract. */
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveResponseCardCandidate } from "../components/eve/eve-response-group-cards";
/* oxlint-enable sort-imports */
import { EveResponseGroupCards } from "../components/eve/eve-response-group-cards";
import { ResponseChoiceCards } from "../components/response-choice-cards";
/* oxlint-enable import/no-relative-parent-imports */

const candidates: EveResponseCardCandidate[] = [
  { modelName: "GPT-5", operationId: "ready", state: "bound", status: "ready" },
  {
    modelName: "Claude Sonnet 4.5",
    operationId: "streaming",
    state: "bound",
    status: "streaming",
  },
  {
    modelName: "Gemini 2.5 Pro",
    operationId: "submitted",
    state: "bound",
    status: "submitted",
  },
  {
    modelName: "Grok",
    operationId: "resuming",
    state: "bound",
    status: "resuming",
  },
  { modelName: "Unknown status", operationId: "unknown", state: "bound" },
  {
    modelName: "Retry candidate",
    operationId: "unresolved",
    state: "unresolved",
  },
  { modelName: "Waiting candidate", operationId: "waiting", state: "waiting" },
  {
    modelName: "Rejected candidate",
    operationId: "rejected",
    state: "rejected",
  },
  {
    modelName: "Failed response",
    operationId: "error",
    state: "bound",
    status: "error",
  },
  {
    disabled: true,
    modelName: "Disabled candidate",
    operationId: "disabled",
    state: "waiting",
  },
  {
    modelName: "Approval candidate",
    operationId: "approval",
    state: "bound",
    status: "awaiting-input",
  },
];
/* oxlint-disable react/jsx-no-literals -- Fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-array-as-prop, react/only-export-components -- * no-magic-numbers (#517): Fixture uses 0, 1 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * react-perf/jsx-no-new-array-as-prop (#556): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision. */
const Fixture = (): React.JSX.Element => {
  const [selected, setSelected] = useState<string | null>("ready");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-xl">Response choices</h1>
      <section aria-label="Existing response layout">
        <h2>Existing response layout</h2>
        <ResponseChoiceCards
          slots={[
            {
              handleSelect: (): void => setSelected("legacy1"),
              id: "legacy1",
              loading: false,
              modelName: "GPT-5",
              selected: true,
              statusLabel: "Selected",
            },
            {
              handleSelect: (): void => setSelected("legacy2"),
              id: "legacy2",
              loading: true,
              modelName: "Claude Sonnet 4.5",
              selected: false,
              statusLabel: "Generating...",
            },
          ]}
        />
      </section>
      <section aria-label="Eve response states">
        <h2>Eve response states</h2>
        <EveResponseGroupCards
          candidates={candidates}
          onSelect={setSelected}
          selectedOperationId={selected}
        />
      </section>
      <p role="status">Selected operation: {selected}</p>
      <section aria-label="Single candidate">
        <EveResponseGroupCards
          candidates={candidates.slice(0, 1)}
          onSelect={setSelected}
          selectedOperationId={selected}
        />
      </section>
      <section aria-label="Empty candidates">
        <ResponseChoiceCards slots={[]} />
      </section>
    </main>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-array-as-prop, react/only-export-components */
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
