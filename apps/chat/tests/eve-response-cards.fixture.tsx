/* oxlint-disable jsx-a11y/prefer-tag-over-role -- The fixture preserves the production-compatible role markup used by its visual contract. */
import { useState } from "react";
import { createRoot } from "react-dom/client";

import { EveResponseGroupCards } from "../components/eve/eve-response-group-cards";
import type { EveResponseCardCandidate } from "../components/eve/eve-response-group-cards";
import { ResponseChoiceCards } from "../components/response-choice-cards";

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
const Fixture = () => {
  const [selected, setSelected] = useState<string | null>("ready");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-xl">Response choices</h1>
      <section aria-label="Existing response layout">
        <h2>Existing response layout</h2>
        <ResponseChoiceCards
          slots={[
            {
              handleSelect: () => setSelected("legacy1"),
              id: "legacy1",
              loading: false,
              modelName: "GPT-5",
              selected: true,
              statusLabel: "Selected",
            },
            {
              handleSelect: () => setSelected("legacy2"),
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
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
