"use client";

/* oxlint-disable sort-imports --
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { EveMessage } from "eve/client";
import React, { useState } from "react";

import { ChatHeaderView } from "@/components/chat-header-view";
import {
  DisposableGuestChat,
  GuestConversationView,
} from "@/components/eve/disposable-guest-chat";
import type { AppModelDefinition } from "@/lib/ai/app-models";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { ChatModelsProvider } from "@/providers/chat-models-provider";
import { DefaultModelProvider } from "@/providers/default-model-provider";
/* oxlint-enable sort-imports */

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
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null --
 * import/no-named-export (#527): Preserve the named GuestVisualFixture API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): GuestVisualFixture remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-ternary (#518): GuestVisualFixture derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * react-perf/jsx-no-new-array-as-prop (#556): GuestVisualFixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react-perf/jsx-no-new-function-as-prop (#557): GuestVisualFixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-max-depth (#548): GuestVisualFixture keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/jsx-no-literals (#549): GuestVisualFixture owns this fixture copy; replacing literal text requires a localization/content-management contract.
 * typescript/prefer-readonly-parameter-types (#565): GuestVisualFixture accepts event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-void-return (#611): GuestVisualFixture's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 * unicorn/no-null (#570): GuestVisualFixture preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
export const GuestVisualFixture = (): React.JSX.Element => {
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
