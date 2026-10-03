/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/controlled-chat-composer"; "../components/eve/eve-thinking-message" dependency within this package instead of introducing an alias or barrel API.
 */
import type { EveMessage } from "eve/client";
import type { ComponentProps } from "react";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { ControlledChatComposer } from "../components/controlled-chat-composer";
import { EveThinkingMessage } from "../components/eve/eve-thinking-message";
/* oxlint-enable import/no-relative-parent-imports */

const states: {
  name: string;
  status: ComponentProps<typeof ControlledChatComposer>["status"];
  cancellable: boolean;
  stopDisabled?: boolean;
  parts?: EveMessage["parts"];
}[] = [
  { cancellable: false, name: "Creating", status: "submitted" },
  { cancellable: true, name: "Submitted", status: "submitted" },
  {
    cancellable: true,
    name: "Waiting for content",
    parts: [
      { type: "step-start" },
      { state: "streaming", text: "", type: "text" },
    ],
    status: "streaming",
  },
  {
    cancellable: true,
    name: "Streaming",
    parts: [{ state: "streaming", text: "Response has started", type: "text" }],
    status: "streaming",
  },
  {
    cancellable: true,
    name: "Reasoning",
    parts: [{ state: "streaming", text: "", type: "reasoning" }],
    status: "streaming",
  },
  {
    cancellable: true,
    name: "Resuming",
    status: "submitted",
    stopDisabled: true,
  },
  { cancellable: true, name: "Ready", status: "ready" },
];

/* oxlint-disable no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-no-literals, react/only-export-components, typescript/prefer-readonly-parameter-types --
 * no-undefined (#519): Fixture uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react-perf/jsx-no-new-array-as-prop (#556): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react-perf/jsx-no-new-function-as-prop (#557): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-no-literals (#549): Fixture owns this fixture copy; replacing literal text requires a localization/content-management contract.
 * react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): Fixture accepts { name, status, cancellable, stopDisabled, parts }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
const Fixture = (): React.JSX.Element => {
  const [stopped, setStopped] = useState("");
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1>Conversation states</h1>
      {states.map(({ name, status, cancellable, stopDisabled, parts }) => (
        <section aria-label={name} key={name}>
          <h2>{name}</h2>
          <EveThinkingMessage
            status={name === "Resuming" ? "resuming" : (status ?? "ready")}
            messages={parts ? [{ id: name, parts, role: "assistant" }] : []}
          />
          <ControlledChatComposer
            disabled={status !== "ready"}
            draft=""
            onDraftChange={() => setStopped("draft changed")}
            onStop={cancellable ? () => setStopped(name) : undefined}
            onSubmit={() => setStopped("unexpected submission")}
            status={status}
            stopDisabled={stopDisabled}
          />
        </section>
      ))}
      <output>{stopped}</output>
    </main>
  );
};
/* oxlint-enable no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-no-literals, react/only-export-components, typescript/prefer-readonly-parameter-types */

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
