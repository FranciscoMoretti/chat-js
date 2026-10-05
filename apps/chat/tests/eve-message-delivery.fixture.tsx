/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/use-eve-message-delivery"; "../lib/eve/message-delivery" dependency within this package instead of introducing an alias or barrel API. */
import type { MessageStreamEvent } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useState } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";

import { useEveMessageDelivery } from "../components/eve/use-eve-message-delivery";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveMessageDeliveryMetadata } from "../lib/eve/message-delivery";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable unicorn/no-null -- * unicorn/no-null (#570): event preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
const event = (operationId: string): MessageStreamEvent => ({
  data: {
    message: "same text",
    metadata: eveMessageDeliveryMetadata(operationId, null),
    sequence: 1,
    turnId: "turn_1",
  },
  meta: { at: "2026-09-13T00:00:00.000Z", id: crypto.randomUUID() },
  type: "message.received",
});
/* oxlint-disable react/jsx-no-literals -- Fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable max-lines-per-function, no-undefined, react/jsx-max-depth, react/only-export-components, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- * max-lines-per-function (#510): Fixture keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): Fixture uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react/jsx-max-depth (#548): Fixture keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): Fixture accepts change; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): Fixture intentionally keeps the existing falsy-value behavior of delivery.pending?.operationId; operationId; delivery.pending.rejection; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const Fixture = (): React.JSX.Element => {
  const delivery = useEveMessageDelivery("fixture-session");
  const [draft, setDraft] = useState("");

  return (
    <main className="mx-auto max-w-xl space-y-4 p-6">
      <h1 className="text-xl font-semibold">Message delivery recovery</h1>
      <label className="block space-y-2">
        <span>Message</span>
        <textarea
          aria-label="Message"
          className="min-h-24 w-full rounded-md border p-3"
          onChange={(change) => setDraft(change.currentTarget.value)}
          value={draft}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => {
            delivery.begin({
              attachments: [],
              message: draft || "same text",
              modelId: "fixture-model",
              selectedTool: undefined,
            });
            setDraft("");
          }}
          type="button"
        >
          Send
        </button>
        <button
          onClick={() =>
            delivery.accept(event("00000000-0000-4000-8000-000000000002"))
          }
          type="button"
        >
          Acknowledge another operation
        </button>
        <button
          disabled={
            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from delivery.pending; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
            !delivery.pending?.operationId
            /* oxlint-enable oxc/no-optional-chaining */
          }
          onClick={() => {
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from delivery.pending; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
            const operationId = delivery.pending?.operationId;
            if (operationId) {
              delivery.accept(event(operationId));
            }
          }}
          type="button"
        >
          Acknowledge pending operation
        </button>
        <button
          disabled={!delivery.pending}
          onClick={() => {
            if (delivery.pending) {
              delivery.reject(delivery.pending, "Insufficient credits");
            }
          }}
          type="button"
        >
          Reject
        </button>
        <button
          disabled={!delivery.pending}
          onClick={() => {
            if (delivery.pending) {
              setDraft(delivery.pending.message);
              delivery.release(delivery.pending);
            }
          }}
          type="button"
        >
          Restore draft
        </button>
      </div>
      <output aria-live="polite" className="block rounded-md border p-3">
        {delivery.pending ? (
          <div className="space-y-1">
            <span className="block">Pending: {delivery.pending.message}</span>
            <span
              className="inline-block font-mono text-xs"
              data-testid="operation"
            >
              {delivery.pending.operationId}
            </span>
            {delivery.pending.rejection && (
              <span className="block">
                Rejected: {delivery.pending.rejection}
              </span>
            )}
          </div>
        ) : (
          "No pending message"
        )}
      </output>
    </main>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-undefined, react/jsx-max-depth, react/only-export-components, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions*/

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
