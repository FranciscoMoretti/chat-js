import { useState } from "react";
import { createRoot } from "react-dom/client";

import {
  type EveResponseCardCandidate,
  EveResponseGroupCards,
} from "../components/eve/eve-response-group-cards";
import { ResponseChoiceCards } from "../components/response-choice-cards";

const candidates: EveResponseCardCandidate[] = [
  { operationId: "ready", modelName: "GPT-5", state: "bound", status: "ready" },
  {
    operationId: "streaming",
    modelName: "Claude Sonnet 4.5",
    state: "bound",
    status: "streaming",
  },
  {
    operationId: "submitted",
    modelName: "Gemini 2.5 Pro",
    state: "bound",
    status: "submitted",
  },
  {
    operationId: "resuming",
    modelName: "Grok",
    state: "bound",
    status: "resuming",
  },
  { operationId: "unknown", modelName: "Unknown status", state: "bound" },
  {
    operationId: "unresolved",
    modelName: "Retry candidate",
    state: "unresolved",
  },
  { operationId: "waiting", modelName: "Waiting candidate", state: "waiting" },
  {
    operationId: "rejected",
    modelName: "Rejected candidate",
    state: "rejected",
  },
  {
    operationId: "error",
    modelName: "Failed response",
    state: "bound",
    status: "error",
  },
  {
    operationId: "disabled",
    modelName: "Disabled candidate",
    state: "waiting",
    disabled: true,
  },
  {
    operationId: "approval",
    modelName: "Approval candidate",
    state: "bound",
    status: "awaiting-input",
  },
];
function Fixture() {
  const [selected, setSelected] = useState<string | null>("ready");
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4">
      <h1 className="text-xl">Response choices</h1>
      <section aria-label="Existing response layout">
        <h2>Existing response layout</h2>
        <ResponseChoiceCards
          slots={[
            {
              id: "legacy1",
              modelName: "GPT-5",
              selected: true,
              loading: false,
              statusLabel: "Selected",
              onSelect: () => setSelected("legacy1"),
            },
            {
              id: "legacy2",
              modelName: "Claude Sonnet 4.5",
              selected: false,
              loading: true,
              statusLabel: "Generating...",
              onSelect: () => setSelected("legacy2"),
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
}
const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
