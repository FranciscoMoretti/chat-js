import type { EveMessage } from "eve/client";
import React, { useState } from "react";
import type { ComponentProps } from "react";
import { createRoot } from "react-dom/client";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { ControlledChatComposer } from "../components/controlled-chat-composer";
import { MessageScrollerProvider } from "../components/ui/message-scroller";
import { EveThinkingMessage } from "../components/eve/eve-thinking-message";

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
            <MessageScrollerProvider>
              <EveThinkingMessage
                status={name === "Resuming" ? "resuming" : (status ?? "ready")}
                messages={parts ? [{ id: name, parts, role: "assistant" }] : []}
              />
            </MessageScrollerProvider>
            <ControlledChatComposer
              disabled={status !== "ready"}
              draft=""
              onDraftChange={() => {
                setStopped("draft changed");
              }}
              onStop={
                cancellable
                  ? () => {
                      setStopped(name);
                    }
                  : undefined
              }
              onSubmit={() => {
                setStopped("unexpected submission");
              }}
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

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
