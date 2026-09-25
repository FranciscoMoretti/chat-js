"use client";

import type { EveMessage } from "eve/client";
import { useState } from "react";

import { ChatHeaderView } from "@/components/chat-header-view";
import {
  DisposableGuestChat,
  GuestConversationView,
} from "@/components/eve/disposable-guest-chat";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";

const [modelId] = ANONYMOUS_LIMITS.AVAILABLE_MODELS;
const model: AppModelDefinition = {
  apiModelId: modelId,
  context_window: 128_000,
  description: "Fixed guest model",
  id: modelId,
  input: { audio: false, image: false, pdf: false, text: true, video: false },
  max_tokens: 16_384,
  name: "Guest fixture model",
  object: "model",
  output: { audio: false, image: false, text: true, video: false },
  owned_by: "openai",
  pricing: {},
  reasoning: false,
  toolCall: false,
  type: "language",
};
const messages: EveMessage[] = [
  {
    id: "user-fixture",
    parts: [{ text: "What makes a useful test?", type: "text" }],
    role: "user",
  },
  {
    id: "assistant-fixture",
    parts: [
      {
        text: "A useful test protects a meaningful behavior and gives a clear failure signal.",
        type: "text",
      },
    ],
    role: "assistant",
  },
];
export const GuestVisualFixture = () => {
  const [state, setState] = useState("welcome");
  const [draft, setDraft] = useState("");
  return (
    <ChatModelsProvider models={[model]}>
      <DefaultModelProvider defaultModel={modelId}>
        <select
          aria-label="Fixture state"
          value={state}
          onChange={(event) => setState(event.target.value)}
        >
          <option value="welcome">Welcome</option>
          <option value="response">Response</option>
          <option value="expired">Expired</option>
        </select>
        <div
          data-testid="guest-visual"
          className="bg-background flex h-[680px] min-h-0 flex-col overflow-hidden"
        >
          {state === "welcome" ? (
            <DisposableGuestChat />
          ) : (
            <>
              <ChatHeaderView breadcrumb={null} />
              <GuestConversationView
                messages={messages}
                modelId={modelId}
                busy={false}
                expired={state === "expired"}
                draft={draft}
                onDraftChange={setDraft}
                onSend={() => null}
                onStop={() => null}
              />
            </>
          )}
        </div>
      </DefaultModelProvider>
    </ChatModelsProvider>
  );
};
