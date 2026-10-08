/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/controlled-chat-composer"; "../components/eve/eve-thinking-message" dependency within this package instead of introducing an alias or barrel API. */
import type { EveMessage } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useState } from "react";
/* oxlint-enable sort-imports */
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";

// oxlint-disable-next-line sort-imports -- Oxfmt groups this type reader import by module; sort-imports requires a different binding-name or syntax order.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ControlledChatComposer } from "../components/controlled-chat-composer";
/* oxlint-enable sort-imports */
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
/* oxlint-disable react/jsx-no-literals -- Fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */

/* oxlint-disable no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/only-export-components -- no-undefined (#519): Fixture uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
react-perf/jsx-no-new-array-as-prop (#556): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
react-perf/jsx-no-new-function-as-prop (#557): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */

const Fixture = (): React.JSX.Element => {
  const [stopped, setStopped] = useState("");
  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <h1>Conversation states</h1>
      {states.map(
        ({
          name,
          status,
          cancellable,
          stopDisabled,
          parts,
        }: ReadonlyNativeSurface<(typeof states)[number]>) => (
          <section aria-label={name} key={name}>
            <h2>{name}</h2>
            <EveThinkingMessage
              // oxlint-disable-next-line no-ternary -- Keep status JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              status={name === "Resuming" ? "resuming" : (status ?? "ready")}
              // oxlint-disable-next-line no-ternary -- Keep messages JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              messages={parts ? [{ id: name, parts, role: "assistant" }] : []}
            />
            <ControlledChatComposer
              disabled={status !== "ready"}
              draft=""
              onDraftChange={() => setStopped("draft changed")}
              // oxlint-disable-next-line no-ternary -- Keep onStop JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              onStop={cancellable ? () => setStopped(name) : undefined}
              onSubmit={() => setStopped("unexpected submission")}
              status={status}
              stopDisabled={stopDisabled}
            />
          </section>
        )
      )}
      <output>{stopped}</output>
    </main>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-undefined, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/only-export-components */

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
