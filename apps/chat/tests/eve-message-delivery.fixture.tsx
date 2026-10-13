import type { MessageStreamEvent } from "eve/client";
import React, { useState } from "react";
import { createRoot } from "react-dom/client";

import { useEveMessageDelivery } from "../components/eve/use-eve-message-delivery";
import { eveMessageDeliveryMetadata } from "../lib/eve/message-delivery";

const event = (
  operationId: string,
  sessionId = "fixture-session"
): MessageStreamEvent => ({
  data: {
    message: "same text",
    metadata: {
      chatjs: {
        ...eveMessageDeliveryMetadata(
          "00000000-0000-4000-8000-000000000003",
          null
        ).chatjs,
        operationIds: [operationId, "00000000-0000-4000-8000-000000000003"],
        sessionId,
      },
    },
    sequence: 1,
    turnId: "turn_1",
  },
  meta: { at: "2026-09-13T00:00:00.000Z", id: crypto.randomUUID() },
  type: "message.received",
});

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
          onChange={(change: {
            readonly currentTarget: { readonly value: string };
          }) => {
            setDraft(change.currentTarget.value);
          }}
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
          onClick={() => {
            delivery.accept(event("00000000-0000-4000-8000-000000000002"));
          }}
          type="button"
        >
          Acknowledge another operation
        </button>
        <button
          onClick={() => {
            delivery.accept(
              event(
                delivery.pending?.operationId ??
                  "00000000-0000-4000-8000-000000000002",
                "foreign-session"
              )
            );
          }}
          type="button"
        >
          Acknowledge foreign session
        </button>
        <button
          disabled={
            delivery.pending === undefined ||
            delivery.pending === null ||
            delivery.pending.operationId === undefined ||
            delivery.pending.operationId === null ||
            delivery.pending.operationId === ""
          }
          onClick={() => {
            const operationId = delivery.pending?.operationId;
            if (
              operationId !== undefined &&
              operationId !== null &&
              operationId !== ""
            ) {
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
            {delivery.pending.rejection !== undefined &&
              delivery.pending.rejection !== null &&
              delivery.pending.rejection !== "" && (
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

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
