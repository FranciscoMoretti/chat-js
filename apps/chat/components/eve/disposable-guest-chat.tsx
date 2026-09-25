"use client";

import type { EveMessage } from "eve/client";
import { useEveAgent } from "eve/react";
import { useEffect, useRef, useState } from "react";
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
import { useDefaultModel } from "@/providers/default-model-provider";

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
              onClick={() => window.dispatchEvent(new Event("chatjs:new-chat"))}
            >
              New chat
            </Button>
          </output>
        )}
        <EveComposer
          autoFocus
          files={files}
          selectedTool={selectedTool}
          onToolChange={setSelectedTool}
          retainedModelId={modelId}
          busy={busy}
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
    window.addEventListener("chatjs:new-chat", reset);
    window.addEventListener("pageshow", restore);
    return () => {
      window.removeEventListener("chatjs:new-chat", reset);
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
                autoFocus
                busy={busy}
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
