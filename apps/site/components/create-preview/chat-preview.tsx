"use client";

import { Activity, useEffect, useLayoutEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { attachmentDigest, draftAttachment } from "../../../chat/lib/eve/draft";
import type { DraftAttachment } from "../../../chat/lib/eve/draft";
import type { UiToolName } from "../../../chat/lib/ai/types";
import { ChatSuggestions } from "../../../chat/components/chat-slots";
import type { ChatSuggestionsProps } from "../../../chat/chatjs/core/chat/contracts";
import { ChatSidebar } from "../../../chat/components/chat/chat-sidebar";
import { ChatNavigationContext } from "../../../chat/components/chat/chat-navigation";
import { EveChatHeader } from "../../../chat/components/eve/eve-chat-header";
import { PreviewComposer } from "./preview-composer";
import { EveChatError } from "../../../chat/components/eve/eve-chat-error";
import { EveArtifactLayout } from "../../../chat/components/eve/eve-artifact-layout";
import { ChatMessageEditor } from "../../../chat/components/chat/chat-message-editor";
import type { ReadonlyEveMessage } from "../../../chat/lib/eve/readonly-message-types";
import { KeyboardShortcuts } from "../../../chat/components/keyboard-shortcuts";
import { GuestPreview } from "./guest-preview";
import { PreviewRuntime } from "./preview-runtime";
import { previewTools } from "./preview-tools";
import { decodePreset, DEFAULT_PRESET_CONFIG } from "shadcn/preset";
import { useTheme } from "next-themes";
import { getPresetCode } from "@/vendor/shadcn-create/lib/preset-code";
import { installationSelectionSchema } from "../../../../packages/registry/installation";

import { startingInstallation } from "../create-model";
import { IconLibraryContext } from "./icons";
import { usePreviewDesignSystem } from "./design-system-context";
import * as native from "./ui/base";
import { PreviewPlugins, previewSession } from "./preview-plugins";
import { sampleConversation } from "./preview-data";
import { ChatConversationScreen } from "../../../chat/components/chat/chat-conversation-screen";
import {
  ChatWorkspace,
  ChatWorkspaceContent,
} from "../../../chat/components/chat/chat-workspace";
import { ChatHeaderView } from "../../../chat/components/chat-header-view";

import { sceneMessages, submittedMessages } from "./scenarios";
import "../../app/create/preview/preview.css";

const readPreset = (code: string) =>
  decodePreset(code) ?? DEFAULT_PRESET_CONFIG;

export const ChatPreview = () => {
  const [params, setParams] = usePreviewDesignSystem();
  const code = getPresetCode(params);
  const preset = readPreset(code);
  const { resolvedTheme, setTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const [installation, setInstallation] = useState(startingInstallation);
  const [guest, setGuest] = useState(false);
  const [scenario, setScenario] = useState<"ready" | "mutation-error">("ready");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<
    {
      id: number;
      text: string;
      attachments: readonly Readonly<DraftAttachment>[];
    }[]
  >([]);
  const [attachments, setAttachments] = useState<
    readonly Readonly<DraftAttachment>[]
  >([]);
  const [selectedTool, setSelectedTool] = useState<UiToolName | null>(null);
  const [status, setStatus] = useState<"ready" | "submitted">("ready");
  const [error, setError] = useState<string>();
  const [edit, setEdit] = useState<{ id: string; text: string }>();
  const [replacements, setReplacements] = useState<Record<string, string>>({});
  const nextMessageId = useRef(0);
  const attachmentGeneration = useRef(0);
  const objectUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const url of objectUrls.current) {
        URL.revokeObjectURL(url);
      }
    },
    []
  );
  const stopResponse = () => {
    setStatus("ready");
  };
  const simulateResponse = () => {
    setStatus("submitted");
  };
  useEffect(() => {
    const timer =
      status === "submitted"
        ? setTimeout(() => {
            setStatus("ready");
          }, 700)
        : undefined;
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  // Reset scene-local state before rendering it; the provider-owned fixture
  // store and query cache survive scene navigation in the same iframe.
  const [scene, setScene] = useState(params.item);
  if (scene !== params.item) {
    setScene(params.item);
    setMessages([]);
    setDraft("");
    setAttachments([]);
    setEdit(undefined);
    setReplacements({});
    setError(undefined);
    setStatus("ready");
  }

  const availableTools = previewTools(installation.tools ?? []);

  const uploads = installation.plugins.includes("attachment-uploads");
  useLayoutEffect(
    () => () => {
      attachmentGeneration.current += 1;
    },
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Invalidate reads whenever the preview context changes.
    [params.item, uploads, guest]
  );
  const welcome = params.item === "preview" && messages.length === 0;
  const conversationTitle =
    params.item === "preview-tools"
      ? "Researching an app"
      : sampleConversation.title;
  const direction = params.rtl ? "rtl" : "ltr";

  useEffect(() => {
    const announceReady = () => {
      window.parent.postMessage(
        { type: "chatjs:create-preview-ready" },
        window.location.origin
      );
    };
    const receive = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent ||
        typeof event.data !== "object" ||
        !event.data
      ) {
        return;
      }
      const message = event.data;
      if (
        "type" in message &&
        message.type === "chatjs:create-request-preview-ready"
      ) {
        announceReady();
        return;
      }
      if (
        !("type" in message) ||
        message.type !== "chatjs:create-installation" ||
        !("installation" in message) ||
        !("mode" in message)
      ) {
        return;
      }
      const selection = installationSelectionSchema.safeParse(
        message.installation
      );
      if (
        !selection.success ||
        (message.mode !== "light" && message.mode !== "dark")
      ) {
        return;
      }
      setInstallation(selection.data);
      setGuest(
        "guest" in message &&
          message.guest === true &&
          selection.data.plugins.includes("guest-chat")
      );
      setScenario(
        "scenario" in message && message.scenario === "mutation-error"
          ? "mutation-error"
          : "ready"
      );
      setTheme(message.mode);
    };
    window.addEventListener("message", receive);
    announceReady();
    return () => {
      window.removeEventListener("message", receive);
    };
  }, [setTheme]);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const selectScene = (item: string) => {
    if (window.parent !== window) {
      window.parent.postMessage(
        { type: "chatjs:create-select-scene", item },
        window.location.origin
      );
      return;
    }
    void setParams({ item });
  };

  const submit = (
    text: string,
    files: readonly Readonly<DraftAttachment>[]
  ) => {
    if (!text && files.length === 0) {
      return;
    }
    if (scenario === "mutation-error") {
      setError(
        "Sample message failed. Your draft has been kept; try again in the ready scenario."
      );
      return;
    }
    setError(undefined);
    simulateResponse();
    const id = nextMessageId.current;
    nextMessageId.current += 1;
    setMessages((previous) => [
      ...previous,
      { id, text, attachments: uploads ? files : [] },
    ]);
    setDraft("");
    attachmentGeneration.current += 1;
    setAttachments([]);
  };

  const send = () => {
    submit(draft.trim(), uploads ? attachments : []);
  };

  const transcriptMessages = [
    ...sceneMessages(params.item, uploads, availableTools),
    ...submittedMessages(messages, installation.gateway),
  ]
    .map((message): ReadonlyEveMessage =>
      replacements[message.id] === undefined
        ? message
        : {
            ...message,
            parts: [
              {
                type: "text",
                state: "done",
                text: replacements[message.id],
              },
            ],
          }
    )
    .map((message) =>
      message.role === "assistant"
        ? { ...message, metadata: { ...message.metadata, turnId: message.id } }
        : message
    );
  const lastMessage = transcriptMessages.at(-1);
  const completionEvents: ChatSuggestionsProps["events"] =
    status === "ready" && lastMessage?.role === "assistant"
      ? [
          {
            type: "turn.settled",
            data: { turnId: lastMessage.id, outcome: "completed" },
            meta: {
              position: { line: 1, index: 0 },
              at: "2026-01-01T00:00:00.000Z",
            },
          },
        ]
      : [];

  const content = (
    <IconLibraryContext value={preset.iconLibrary}>
      <PreviewPlugins enabled={installation.plugins} scenario={scenario}>
        <PreviewRuntime
          tools={availableTools}
          aiTitles={installation.plugins.includes("ai-titles")}
          onDeleted={() => {
            selectScene("preview");
            setMessages([]);
          }}
        >
          {guest && (
            <GuestPreview
              direction={direction}
              gateway={installation.gateway}
              theme={resolvedTheme}
              onThemeChange={setTheme}
            />
          )}
          <Activity mode={guest ? "hidden" : "visible"}>
            <ChatNavigationContext
              value={{
                pathname: welcome ? "/" : `/chat/${sampleConversation.id}`,
                navigate: (href) => {
                  if (href === "/") {
                    selectScene("preview");
                    setMessages([]);
                    setDraft("");
                    attachmentGeneration.current += 1;
                    setAttachments([]);
                    setEdit(undefined);
                    setReplacements({});
                    stopResponse();
                  } else if (
                    href.startsWith("/chat/") ||
                    href.startsWith("/project/")
                  ) {
                    selectScene("preview-02");
                  } else {
                    toast.info(
                      "This destination is not previewed yet. It is available in the generated app."
                    );
                  }
                },
              }}
            >
              <ChatWorkspace
                className="create-chat-preview bg-background text-foreground flex h-dvh min-h-0 w-full text-sm"
                data-testid="chat-preview"
                data-base={params.base}
                data-preset={code}
                data-style={preset.style}
                data-icons={preset.iconLibrary}
                data-mode={mode}
              >
                <KeyboardShortcuts />
                <ChatSidebar
                  direction={direction}
                  conversationId={sampleConversation.id}
                  history={{ ownerId: "preview-user", history: undefined }}
                  ownerId="preview-user"
                  onChatSelect={() => {
                    selectScene("preview-02");
                  }}
                  account={{
                    user: previewSession.data.user,
                    isPending: false,
                    theme: resolvedTheme,
                    onThemeChange: setTheme,
                    onSignIn: () => {
                      toast.info(
                        "Authentication is available in the generated app."
                      );
                    },
                    onSignOut: () => {
                      toast.info(
                        "This is a sample account; no session was signed out."
                      );
                    },
                  }}
                  onProjectSelect={() => {
                    selectScene("preview-02");
                  }}
                />
                <ChatWorkspaceContent>
                  <EveArtifactLayout conversationId={sampleConversation.id}>
                    <ChatConversationScreen
                      conversationId={params.item}
                      header={
                        welcome ? (
                          <ChatHeaderView breadcrumb={null} />
                        ) : (
                          <EveChatHeader
                            chatId={sampleConversation.id}
                            conversationId={sampleConversation.id}
                            fallbackTitle={conversationTitle}
                            hasMessages
                          />
                        )
                      }
                      welcome={welcome}
                      status={status}
                      transcript={{
                        conversationId: sampleConversation.id,
                        messages: transcriptMessages,
                        suggestions: (
                          <ChatSuggestions
                            sessionId="preview-session"
                            conversationId={sampleConversation.id}
                            events={completionEvents}
                            lastMessage={lastMessage}
                            disabled={status !== "ready"}
                            onSelect={(suggestion) => {
                              submit(suggestion, []);
                            }}
                          />
                        ),
                        isReadonly: false,
                        disabled: status !== "ready",
                        respond: () => {
                          /* Completed fixtures do not request input. */
                        },
                        onEdit: (message) => {
                          setEdit({
                            id: message.id,
                            text: message.parts
                              .filter((part) => part.type === "text")
                              .map((part) => part.text)
                              .join("\n"),
                          });
                        },
                        editor: edit
                          ? {
                              messageId: edit.id,
                              disabled: status !== "ready",
                              onCancel: () => {
                                setEdit(undefined);
                              },
                              content: (
                                <ChatMessageEditor
                                  error={error}
                                  composer={
                                    <PreviewComposer
                                      draft={edit.text}
                                      onDraftChange={(text) => {
                                        setEdit({ ...edit, text });
                                      }}
                                      disabled={false}
                                      onSubmit={() => {
                                        if (scenario === "mutation-error") {
                                          setError(
                                            "Sample edit failed. Your draft has been kept."
                                          );
                                          return;
                                        }
                                        setReplacements((previous) => ({
                                          ...previous,
                                          [edit.id]: edit.text,
                                        }));
                                        setEdit(undefined);
                                        setError(undefined);
                                        simulateResponse();
                                      }}
                                    />
                                  }
                                />
                              ),
                            }
                          : undefined,
                        onRegenerate: () => {
                          simulateResponse();
                        },
                      }}
                      notices={
                        error === undefined ? undefined : (
                          <EveChatError message={error} />
                        )
                      }
                      composer={
                        <PreviewComposer
                          draft={draft}
                          onDraftChange={setDraft}
                          onSubmit={send}
                          disabled={false}
                          status={status}
                          onStop={stopResponse}
                          autoFocus={!welcome && messages.length > 0}
                          capabilities={{
                            selectedTool,
                            onToolChange: setSelectedTool,
                            files: {
                              attachments: uploads ? attachments : [],
                              setAttachments,
                              uploadQueue: [],
                              enabled: uploads,
                              busy: false,
                              errors: [],
                              enqueue: async (files) => {
                                const generation = attachmentGeneration.current;
                                const digests = await Promise.all(
                                  files.map(
                                    async (file) =>
                                      await attachmentDigest(
                                        await file.arrayBuffer()
                                      )
                                  )
                                );
                                if (
                                  generation !== attachmentGeneration.current
                                ) {
                                  return;
                                }
                                const added = files.map((file, index) => {
                                  const url = URL.createObjectURL(file);
                                  objectUrls.current.push(url);
                                  return draftAttachment.parse({
                                    name: file.name,
                                    contentType: file.type,
                                    digest: digests[index],
                                    url,
                                  });
                                });
                                setAttachments((current) => [
                                  ...current,
                                  ...added,
                                ]);
                              },
                            },
                          }}
                        />
                      }
                    />
                  </EveArtifactLayout>
                </ChatWorkspaceContent>
              </ChatWorkspace>
            </ChatNavigationContext>
          </Activity>
        </PreviewRuntime>
      </PreviewPlugins>
    </IconLibraryContext>
  );
  if (params.base !== "base") {
    return (
      <p role="alert">
        This preview uses Base UI. Choose Base UI in Create to continue.
      </p>
    );
  }
  return (
    <native.DirectionProvider direction={direction}>
      {content}
    </native.DirectionProvider>
  );
};
