"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SessionContext } from "../../../chat/providers/session-context";
import { Plugins } from "../../../chat/chatjs/core/ui/slots";
import { ChatSidebar } from "../../../chat/components/chat/chat-sidebar";
import { ChatNavigationContext } from "../../../chat/components/chat/chat-navigation";
import {
  ChatWorkspace,
  ChatWorkspaceContent,
} from "../../../chat/components/chat/chat-workspace";
import { KeyboardShortcuts } from "../../../chat/components/keyboard-shortcuts";
import {
  GuestChatLayout,
  GuestConversationView,
  GuestWelcomeView,
} from "../../../chat/chatjs/plugins/guest-chat/signed-out";
import { guestModelIdForGateway } from "../../../chat/chatjs/plugins/guest-chat/guest-policy";
import type { ReadonlyEveMessage } from "../../../chat/lib/eve/readonly-message-types";

const guestSession = { data: null, isPending: false };
const guestHistory = { ownerId: undefined, history: undefined };
const noPlugins: readonly never[] = [];

const signIn = () => {
  toast.info("Sign-in is available in the installed app.");
};

export const GuestPreview = ({
  direction,
  gateway,
  theme,
  onThemeChange,
}: {
  readonly direction: "ltr" | "rtl";
  readonly gateway: string | undefined;
  readonly theme: string | undefined;
  readonly onThemeChange: (theme: string) => void;
}) => {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<readonly ReadonlyEveMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);
  const modelId = guestModelIdForGateway(gateway ?? "vercel");

  const stop = () => {
    window.clearTimeout(timer.current ?? 0);
    timer.current = null;
    setBusy(false);
  };

  useEffect(() => {
    const reset = () => {
      window.clearTimeout(timer.current ?? 0);
      timer.current = null;
      setBusy(false);
      setMessages([]);
      setDraft("");
    };
    window.addEventListener("chatjs:new-chat", reset);
    return () => {
      window.removeEventListener("chatjs:new-chat", reset);
      window.clearTimeout(timer.current ?? 0);
    };
  }, []);

  const send = (text: string) => {
    if (!text || timer.current !== null) {
      return;
    }
    setDraft("");
    setMessages((previous) => [
      ...previous,
      {
        id: `guest-${previous.length}`,
        role: "user",
        parts: [{ type: "text", state: "done", text }],
      },
    ]);
    setBusy(true);
    timer.current = window.setTimeout(() => {
      setMessages((previous) => [
        ...previous,
        {
          id: `guest-${previous.length}`,
          role: "assistant",
          parts: [
            {
              type: "text",
              state: "done",
              text: "This is a sample guest reply. In your app, visitors can chat before signing in.",
            },
          ],
        },
      ]);
      stop();
    }, 700);
  };

  return (
    <SessionContext value={guestSession}>
      <Plugins plugins={noPlugins}>
        <ChatNavigationContext
          value={{
            pathname: "/",
            navigate: (href) => {
              if (href === "/login") {
                signIn();
              }
            },
          }}
        >
          <ChatWorkspace
            defaultOpen={false}
            data-testid="guest-preview"
            className="create-chat-preview bg-background text-foreground flex h-dvh min-h-0 w-full text-sm"
          >
            <KeyboardShortcuts />
            <ChatSidebar
              direction={direction}
              history={guestHistory}
              account={{
                user: undefined,
                isPending: false,
                theme,
                onThemeChange,
                onSignIn: signIn,
                onSignOut: signIn,
              }}
            />
            <ChatWorkspaceContent>
              <GuestChatLayout>
                {messages.length === 0 ? (
                  <GuestWelcomeView
                    modelId={modelId}
                    busy={busy}
                    draft={draft}
                    onDraftChange={setDraft}
                    onSend={() => {
                      send(draft.trim());
                    }}
                  />
                ) : (
                  <GuestConversationView
                    modelId={modelId}
                    messages={messages}
                    busy={busy}
                    expired={false}
                    draft={draft}
                    onDraftChange={setDraft}
                    onSend={send}
                    onStop={stop}
                  />
                )}
              </GuestChatLayout>
            </ChatWorkspaceContent>
          </ChatWorkspace>
        </ChatNavigationContext>
      </Plugins>
    </SessionContext>
  );
};
