"use client";

import type { EveMessage } from "eve/client";
import { useEveAgent } from "eve/react";
import React, { useEffect, useRef, useState } from "react";
import { z } from "zod";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatHeaderView } from "@/components/chat-header-view";
import { ChatLayout, ChatLayoutMain } from "@/components/chat/chat-layout";
import { ChatWelcomeView } from "@/components/chat/chat-welcome-view";
import { Button } from "@/components/ui/button";
import type { UiToolName } from "@/lib/ai/types";
/* oxlint-disable import/max-dependencies -- @/providers/default-model-provider import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { useDefaultModel } from "@/providers/default-model-provider";
/* oxlint-enable import/max-dependencies */

import { EveComposer } from "./eve-composer";
import { EveMessages } from "./eve-messages";
import { useEveAttachments } from "./use-eve-attachments";

const bindingSchema = z.object({
  credential: z.string(),
  expiresAt: z.number(),
  sessionId: z.string(),
});
type Binding = z.infer<typeof bindingSchema> & {
  firstMessage: string;
  modelId: string;
};
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- retireGuest: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including binding: Binding). */

const retireGuest = async (binding: Binding) => {
  try {
    await fetch(`/eve/guest/v1/session/${binding.sessionId}/reset`, {
      body: "{}",
      headers: {
        authorization: `Bearer ${binding.credential}`,
        "content-type": "application/json",
      },
      keepalive: true,
      method: "POST",
    });
  } catch {
    // Unload delivery is best effort. EVE's session timeout handles abandonment.
  }
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type -- createGuestSession: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const createGuestSession = async (modelId: string) => {
  const response = await fetch("/api/eve-guest", {
    body: JSON.stringify({ modelId }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Could not start chat. Please try again.");
  }
  return bindingSchema.parse(await response.json());
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- GuestConversationView: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; jsdoc/require-param: the TypeScript signature describes these parameters; the prose documents behavior rather than duplicate tags; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failure); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** Shared guest presentation, also exercised with deterministic visual fixtures. */
export const GuestConversationView = ({
  messages,
  modelId,
  busy,
  failure,
  expired,
  draft,
  onDraftChange,
  onSend,
  onStop,
}: {
  messages: readonly EveMessage[];
  modelId: string;
  busy: boolean;
  failure?: string;
  expired: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) => {
  const files = useEveAttachments();
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  return (
    <>
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          <EveMessages
            messages={messages}
            isReadonly={false}
            disabled={busy}
            respond={() => {
              // Guest sessions do not expose tool input requests.
            }}
            modelForMessage={() => modelId}
          />
          {busy && (
            <output className="text-muted-foreground text-sm">
              Responding…
            </output>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-4">
        {failure && (
          <p role="alert" className="text-destructive mb-3 text-sm">
            {failure}
          </p>
        )}
        {expired && (
          <output className="text-muted-foreground mb-3 text-sm">
            This chat has expired. Start a new chat to continue.
            <Button
              variant="link"
              onClick={() => {
                globalThis.dispatchEvent(new Event("chatjs:new-chat"));
              }}
            >
              New chat
            </Button>
          </output>
        )}
        <EveComposer
          // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Preserve guest conversation initial focus; changing navigation focus requires an accessibility and UX decision.
          autoFocus
          files={files}
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          retainedModelId={modelId}
          status={busy ? "streaming" : "ready"}
          disabled={busy || expired}
          draft={draft}
          onDraftChange={onDraftChange}
          onSubmit={() => {
            onSend(draft.trim());
          }}
          onStop={
            busy && !expired
              ? () => {
                  onStop();
                }
              : undefined
          }
        />
      </div>
    </>
  );
};
/* oxlint-enable import/exports-last, import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- GuestConversation: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { binding }: { binding: Binding }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including agent.error?.message). */

const GuestConversation = ({ binding }: { binding: Binding }) => {
  const agent = useEveAgent({
    agent: "guest",
    auth: { bearer: binding.credential },
    initialSession: { sessionId: binding.sessionId, streamIndex: 0 },
  });
  const [draft, setDraft] = useState("");

  const [commandError, setCommandError] = useState("");
  const [expired, setExpired] = useState(false);
  const started = useRef(false);
  const pending = useRef(false);
  const busy =
    agent.status === "submitted" ||
    agent.status === "streaming" ||
    agent.status === "resuming";
  const send = async (text: string) => {
    if (pending.current) {
      return;
    }
    if (Date.now() >= binding.expiresAt) {
      setExpired(true);
      return;
    }
    pending.current = true;
    setCommandError("");
    setDraft("");
    try {
      await agent.send(text);
    } catch (error) {
      setCommandError(
        error instanceof Error ? error.message : "Message could not be sent."
      );
      setDraft(text);
    }
    pending.current = false;
  };
  useEffect(() => {
    // EVE attaches its observer on the next task. Defer the initial send too,
    // so React Strict Mode's probe cleanup cannot abort the first message.
    const timer = setTimeout(() => {
      if (!started.current) {
        started.current = true;
        void send(binding.firstMessage);
      }
    }, 0);
    return () => clearTimeout(timer);
  });
  useEffect(() => {
    const timer = setTimeout(
      () => setExpired(true),
      Math.max(0, binding.expiresAt - Date.now())
    );
    return () => clearTimeout(timer);
  }, [binding.expiresAt]);
  useEffect(() => {
    const retire = () => {
      void retireGuest(binding);
    };
    window.addEventListener("pagehide", retire);
    return () => window.removeEventListener("pagehide", retire);
  }, [binding]);
  const stop = async () => {
    try {
      await agent.cancel();
    } catch {
      setCommandError("Could not stop the response.");
    }
  };
  const latestTurn = agent.events.findLast(
    (event) =>
      event.type === "turn.started" ||
      event.type === "turn.failed" ||
      event.type === "turn.completed" ||
      event.type === "turn.cancelled"
  );
  const failure =
    commandError ||
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Falsy state or empty error text intentionally selects the existing fallback; coalescing would retain the empty value.
    agent.error?.message ||
    (latestTurn?.type === "turn.failed" ? latestTurn.data.message : undefined);
  return (
    <GuestConversationView
      messages={agent.data.messages}
      modelId={binding.modelId}
      busy={busy}
      failure={failure}
      expired={expired}
      draft={draft}
      onDraftChange={setDraft}
      onSend={(text) => {
        void send(text);
      }}
      onStop={() => {
        void stop();
      }}
    />
  );
};
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
/* oxlint-disable import/group-exports, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- DisposableGuestChat: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; jsdoc/require-returns: the inferred or annotated return type describes the value; the prose documents behavior rather than duplicate tags; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: PageTransitionEvent); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

/** No URL, cookie, storage, or persisted application identity owns this chat. */
export const DisposableGuestChat = () => {
  const [binding, setBinding] = useState<Binding>();
  const [draft, setDraft] = useState("");
  const files = useEveAttachments();
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  const modelId = useDefaultModel();
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState("");
  const pending = useRef(false);
  const generation = useRef(0);
  const submit = async () => {
    if (pending.current || !draft.trim()) {
      return;
    }
    const currentGeneration = generation.current;
    pending.current = true;
    setBusy(true);
    setCommandError("");
    try {
      const created = {
        ...(await createGuestSession(modelId)),
        firstMessage: draft.trim(),
        modelId,
      };
      if (generation.current !== currentGeneration) {
        void retireGuest(created);
        return;
      }
      setBinding(created);
      setDraft("");
    } catch (error) {
      if (generation.current !== currentGeneration) {
        return;
      }
      setCommandError(
        error instanceof Error ? error.message : "Could not start chat."
      );
    }
    if (generation.current === currentGeneration) {
      pending.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    const reset = () => {
      generation.current += 1;
      pending.current = false;
      setBusy(false);
      if (binding) {
        void retireGuest(binding);
      }
      setBinding(undefined);
      setDraft("");
      setCommandError("");
    };
    const restore = (event: PageTransitionEvent) => {
      if (event.persisted) {
        reset();
      }
    };
    globalThis.addEventListener("chatjs:new-chat", reset);
    window.addEventListener("pageshow", restore);
    return () => {
      globalThis.removeEventListener("chatjs:new-chat", reset);
      window.removeEventListener("pageshow", restore);
    };
  }, [binding]);
  return (
    <ChatLayout isSecondaryPanelVisible={false}>
      <ChatLayoutMain defaultSize={100}>
        <section className="flex h-full min-h-0 flex-col">
          <ChatHeaderView breadcrumb={null} className="h-(--header-height)" />
          {binding ? (
            <GuestConversation binding={binding} key={binding.sessionId} />
          ) : (
            <ChatWelcomeView>
              {commandError && (
                <p role="alert" className="text-destructive mb-3 text-sm">
                  {commandError}
                </p>
              )}
              <EveComposer
                // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: Preserve the guest welcome typing workflow; changing initial page focus requires accessibility and UX review.
                autoFocus
                status={busy ? "submitted" : "ready"}
                disabled={busy || !modelId}
                draft={draft}
                onDraftChange={setDraft}
                onSubmit={() => {
                  void submit();
                }}
                files={files}
                selectedTool={selectedTool}
                onToolChange={setSelectedTool}
              />
            </ChatWelcomeView>
          )}
        </section>
      </ChatLayoutMain>
    </ChatLayout>
  );
};
/* oxlint-enable import/group-exports, jsdoc/require-returns, max-lines-per-function, max-statements, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-lines -- disposable-guest-chat keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
