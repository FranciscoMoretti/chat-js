"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { decodePreset, DEFAULT_PRESET_CONFIG } from "shadcn/preset";
import { useTheme } from "next-themes";
import { getPresetCode } from "@/vendor/shadcn-create/lib/preset-code";
import { installationSelectionSchema } from "../../../../packages/registry/installation";
import { ChatMessageView } from "../../../chat/components/chat-message-view";
import { ChatSidebarView } from "../../../chat/components/chat-sidebar-view";
import { AttachmentCardView } from "../../../chat/components/attachment-card-view";
import { ComposerAttachments } from "../../../chat/components/composer/composer-attachments";
import { ControlledChatComposer } from "../../../chat/components/controlled-chat-composer";
import { ChatWelcomeView } from "../../../chat/components/chat/chat-welcome-view";
import { ToolActivity } from "../../../chat/components/part/tool-activity";
import { ToolOutput } from "../../../chat/components/part/tool-data";
import { startingInstallation } from "../create-model";
import { IconLibraryContext, PreviewIcon } from "./icons";
import { usePreviewDesignSystem } from "./design-system-context";
import * as native from "./ui/base";
import * as nativeRadix from "./ui/radix";
import "../../app/create/preview/preview.css";

interface SceneButtonProps {
  readonly onSelect: () => void;
  readonly children: ReactNode;
  readonly className?: string;
  readonly isActive?: boolean;
}

const BaseSceneButton = ({
  onSelect,
  children,
  ...props
}: SceneButtonProps) => {
  const { setOpenMobile } = native.useSidebar();
  return (
    <native.SidebarMenuItem>
      <native.SidebarMenuButton
        {...props}
        onClick={() => {
          onSelect();
          setOpenMobile(false);
        }}
      >
        {children}
      </native.SidebarMenuButton>
    </native.SidebarMenuItem>
  );
};
const RadixSceneButton = ({
  onSelect,
  children,
  ...props
}: SceneButtonProps) => {
  const { setOpenMobile } = nativeRadix.useSidebar();
  return (
    <nativeRadix.SidebarMenuItem>
      <nativeRadix.SidebarMenuButton
        {...props}
        onClick={() => {
          onSelect();
          setOpenMobile(false);
        }}
      >
        {children}
      </nativeRadix.SidebarMenuButton>
    </nativeRadix.SidebarMenuItem>
  );
};

const readPreset = (code: string) =>
  decodePreset(code) ?? DEFAULT_PRESET_CONFIG;

const previewNotice = (
  notice: string,
  gateway: string | undefined,
  uploads: boolean,
  storage?: string
) =>
  notice ||
  `Interactive preview · ${gateway}${uploads ? ` · ${storage} uploads` : ""}`;

export const ChatPreview = () => {
  const [params, setParams] = usePreviewDesignSystem();
  const code = getPresetCode(params);
  const preset = readPreset(code);
  const { resolvedTheme, setTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const [installation, setInstallation] = useState(startingInstallation);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<
    { text: string; attached: boolean }[]
  >([]);
  const [attached, setAttached] = useState(false);
  const [model, setModel] = useState("Balanced");
  const viewNames: Record<string, string> = {
    preview: "New chat",
    "preview-tools": "Tool states",
  };
  const view = viewNames[params.item] ?? "Conversation";
  const [notice, setNotice] = useState("");

  const uploads = installation.plugins.includes("attachment-uploads");
  const radix = params.base === "radix";
  const SceneButton = radix ? RadixSceneButton : BaseSceneButton;
  const hasAttachments = attached && uploads;
  const welcome = view === "New chat" && messages.length === 0;
  const direction = params.rtl ? "rtl" : "ltr";
  const ui = radix ? nativeRadix : native;
  const BaseDropdownMenuTrigger = native.DropdownMenuTrigger;
  const RadixDropdownMenuTrigger = nativeRadix.DropdownMenuTrigger;
  const {
    Button,
    SidebarProvider,
    SidebarTrigger,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    AttachmentActions,
    AttachmentAction,
    CodeBlock,
    CodeBlockHeader,
    CodeBlockTitle,
    CodeBlockActions,
    CodeBlockCopyButton,
    CodeBlockContent,
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    Bubble,
    BubbleContent,
    MessageScrollerProvider,
    MessageScroller,
    MessageScrollerViewport,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerButton,
  } = ui;
  const {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
  } = ui;

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

  const send = () => {
    const text = draft.trim();
    if (!text && !hasAttachments) {
      return;
    }
    setMessages((previous) => [
      ...previous,
      { text, attached: hasAttachments },
    ]);
    setDraft("");
    setAttached(false);
  };

  const composer = (
    <>
      <ControlledChatComposer
        primitives={{ InputGroup, InputGroupAddon, InputGroupButton }}
        autoFocus={!welcome && messages.length > 0}
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={send}
        disabled={false}
        hasAttachments={hasAttachments}
        sendIcon={<PreviewIcon name="up" />}
        attachments={
          hasAttachments && (
            <ComposerAttachments primitives={{ InputGroupAddon }}>
              <AttachmentCardView
                primitives={ui}
                title="project-notes.md"
                media={<PreviewIcon name="file" />}
                actions={
                  <AttachmentActions>
                    <AttachmentAction
                      aria-label="Remove sample attachment"
                      type="button"
                      onClick={() => {
                        setAttached(false);
                      }}
                    >
                      <PreviewIcon name="close" />
                    </AttachmentAction>
                  </AttachmentActions>
                }
              />
            </ComposerAttachments>
          )
        }
        tools={
          <>
            {uploads && (
              <InputGroupButton
                size="icon-sm"
                aria-label="Attach sample file"
                onClick={() => {
                  setAttached(true);
                }}
              >
                <PreviewIcon name="plus" />
              </InputGroupButton>
            )}
            <DropdownMenu>
              {radix ? (
                <RadixDropdownMenuTrigger asChild>
                  <InputGroupButton aria-label="Choose preview model">
                    {model}
                    <PreviewIcon name="down" />
                  </InputGroupButton>
                </RadixDropdownMenuTrigger>
              ) : (
                <BaseDropdownMenuTrigger
                  render={<InputGroupButton />}
                  aria-label="Choose preview model"
                >
                  {model}
                  <PreviewIcon name="down" />
                </BaseDropdownMenuTrigger>
              )}
              <DropdownMenuContent side="top" className="min-w-48">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {installation.gateway} models
                  </DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={model}
                    onValueChange={setModel}
                  >
                    {["Balanced", "Fast", "Reasoning"].map((name) => (
                      <DropdownMenuRadioItem
                        key={name}
                        value={name}
                        {...(radix ? {} : { closeOnClick: true })}
                      >
                        {name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <p
        className="text-muted-foreground mt-3 text-center text-[11px]"
        aria-live="polite"
      >
        {previewNotice(
          notice,
          installation.gateway,
          uploads,
          installation.storage?.source
        )}
      </p>
    </>
  );

  const content = (
    <IconLibraryContext value={preset.iconLibrary}>
      <SidebarProvider
        className="create-chat-preview bg-background text-foreground flex h-dvh min-h-0 w-full text-sm"
        data-testid="chat-preview"
        data-base={params.base}
        data-preset={code}
        data-style={preset.style}
        data-icons={preset.iconLibrary}
        data-mode={mode}
      >
        <ChatSidebarView
          primitives={ui}
          direction={direction}
          header={
            <SidebarMenu>
              <div className="flex items-center gap-2 px-2 py-2 font-semibold">
                <PreviewIcon name="chat" />
                <span className="group-data-[collapsible=icon]:hidden">
                  ChatJS
                </span>
              </div>
              <SceneButton
                className="mt-4"
                onSelect={() => {
                  selectScene("preview");
                  setMessages([]);
                  setDraft("");
                  setAttached(false);
                  setNotice("Started a new preview conversation.");
                }}
              >
                <PreviewIcon name="plus" />
                <span>New chat</span>
              </SceneButton>
            </SidebarMenu>
          }
          footer={
            <div className="flex items-center gap-3 px-2">
              <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                YO
              </div>
              <div className="group-data-[collapsible=icon]:hidden">
                <p className="font-medium">Your workspace</p>
                <p className="text-muted-foreground text-xs">
                  Personal account
                </p>
              </div>
            </div>
          }
        >
          <SidebarMenu>
            <span className="text-muted-foreground px-2 text-xs">Today</span>
            <SceneButton
              isActive
              onSelect={() => {
                selectScene("preview-02");
                setMessages([]);
              }}
            >
              Building something good
            </SceneButton>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={() => {
                  setNotice("This preview keeps one sample conversation.");
                }}
              >
                Weekend reading list
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </ChatSidebarView>
        <main className="@container flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <SidebarTrigger />
              <span className="truncate font-medium">
                {welcome ? "ChatJS" : "Building something good"}
              </span>
            </div>
            <DropdownMenu>
              {radix ? (
                <RadixDropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Preview scenario"
                  >
                    {view}
                    <PreviewIcon name="down" />
                  </Button>
                </RadixDropdownMenuTrigger>
              ) : (
                <BaseDropdownMenuTrigger
                  render={<Button variant="ghost" size="sm" />}
                  aria-label="Preview scenario"
                >
                  {view}
                  <PreviewIcon name="down" />
                </BaseDropdownMenuTrigger>
              )}
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Preview scenes</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={view}
                    onValueChange={(value: string) => {
                      const items: Record<string, string> = {
                        "New chat": "preview",
                        "Tool states": "preview-tools",
                      };
                      selectScene(items[value] ?? "preview-02");
                      setMessages([]);
                    }}
                  >
                    {["Conversation", "New chat", "Tool states"].map((name) => (
                      <DropdownMenuRadioItem
                        key={name}
                        value={name}
                        {...(radix ? {} : { closeOnClick: true })}
                      >
                        {name}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          {welcome ? (
            <ChatWelcomeView>{composer}</ChatWelcomeView>
          ) : (
            <>
              <MessageScrollerProvider
                key={params.item}
                autoScroll
                defaultScrollPosition="end"
              >
                <MessageScroller className="flex-1">
                  <MessageScrollerViewport>
                    <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-7 p-4">
                      <MessageScrollerItem messageId="sample-scene">
                        {view === "Tool states" && (
                          <div className="flex flex-col gap-4">
                            <h1 className="font-heading text-xl font-semibold">
                              Tools at work
                            </h1>
                            <p className="text-muted-foreground">
                              Sample states for the tools in a conversation.
                            </p>
                            <ToolActivity
                              primitives={ui}
                              title="Reviewing project notes"
                              state="input-available"
                              defaultOpen
                            >
                              <p className="text-muted-foreground mt-3">
                                Reading the brief and gathering context…
                              </p>
                            </ToolActivity>
                            <ToolActivity
                              primitives={ui}
                              title="Project activity"
                              state="output-available"
                              defaultOpen
                            >
                              <svg
                                className="mt-4 h-28 w-full"
                                viewBox="0 0 320 100"
                                aria-label="Sample activity chart using the five native chart colors"
                              >
                                <rect
                                  x="20"
                                  y="45"
                                  width="40"
                                  height="55"
                                  fill="var(--chart-1)"
                                  rx="4"
                                />
                                <rect
                                  x="80"
                                  y="30"
                                  width="40"
                                  height="70"
                                  fill="var(--chart-2)"
                                  rx="4"
                                />
                                <rect
                                  x="140"
                                  y="10"
                                  width="40"
                                  height="90"
                                  fill="var(--chart-3)"
                                  rx="4"
                                />
                                <rect
                                  x="200"
                                  y="35"
                                  width="40"
                                  height="65"
                                  fill="var(--chart-4)"
                                  rx="4"
                                />
                                <rect
                                  x="260"
                                  y="20"
                                  width="40"
                                  height="80"
                                  fill="var(--chart-5)"
                                  rx="4"
                                />
                              </svg>
                            </ToolActivity>
                            <ToolActivity
                              primitives={ui}
                              title="Search unavailable"
                              state="output-error"
                              defaultOpen
                            >
                              <ToolOutput
                                primitives={ui}
                                errorText="The service could not be reached. Your conversation is saved."
                              />
                              <Button
                                className="mt-3"
                                variant="outline"
                                onClick={() => {
                                  setNotice(
                                    "This is a sample error state. No external tool runs in the preview."
                                  );
                                }}
                              >
                                Retry sample tool
                              </Button>
                            </ToolActivity>
                          </div>
                        )}
                        {view === "Conversation" && (
                          <div className="flex flex-col gap-7">
                            <ChatMessageView author="user" primitives={ui}>
                              <Bubble variant="muted">
                                <BubbleContent>
                                  Help me build a small app people will love.
                                </BubbleContent>
                              </Bubble>
                            </ChatMessageView>
                            <ChatMessageView author="assistant" primitives={ui}>
                              <Bubble variant="ghost">
                                <BubbleContent className="flex flex-col gap-4">
                                  <h1 className="font-heading text-xl font-semibold tracking-tight">
                                    A small start. A great experience.
                                  </h1>
                                  <p>
                                    Start with one useful conversation. Keep the
                                    interface clear, let people bring their
                                    context, and make every interaction feel
                                    considered.
                                  </p>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="rounded-lg border p-4">
                                      <p className="font-medium">
                                        Make it personal
                                      </p>
                                      <p className="text-muted-foreground mt-1 text-sm">
                                        Your colors, your typography, your way
                                        of working.
                                      </p>
                                    </div>
                                    <div className="rounded-lg border p-4">
                                      <p className="font-medium">
                                        Keep it simple
                                      </p>
                                      <p className="text-muted-foreground mt-1 text-sm">
                                        A focused workspace that gets out of the
                                        way.
                                      </p>
                                    </div>
                                  </div>
                                  <ToolActivity
                                    primitives={ui}
                                    title="Project outline ready"
                                    state="output-available"
                                    icon={<PreviewIcon name="check" />}
                                  >
                                    <ol className="text-muted-foreground mt-3 flex list-inside list-decimal flex-col gap-2">
                                      <li>Choose a visual direction</li>
                                      <li>Connect your model provider</li>
                                      <li>Ship your first conversation</li>
                                    </ol>
                                  </ToolActivity>
                                  <CodeBlock>
                                    <CodeBlockHeader>
                                      <CodeBlockTitle>terminal</CodeBlockTitle>
                                      <CodeBlockActions>
                                        <CodeBlockCopyButton value="bunx @chat-js/cli@beta create my-chat" />
                                      </CodeBlockActions>
                                    </CodeBlockHeader>
                                    <CodeBlockContent>
                                      bunx @chat-js/cli@beta create my-chat
                                    </CodeBlockContent>
                                  </CodeBlock>
                                  <div className="text-muted-foreground flex items-center gap-2 text-xs">
                                    <PreviewIcon name="check" />
                                    <span>Ready when you are.</span>
                                  </div>
                                </BubbleContent>
                              </Bubble>
                            </ChatMessageView>
                            {uploads && (
                              <ChatMessageView author="user" primitives={ui}>
                                <AttachmentCardView
                                  primitives={ui}
                                  title="project-notes.md"
                                  media={<PreviewIcon name="file" />}
                                />
                              </ChatMessageView>
                            )}
                          </div>
                        )}
                      </MessageScrollerItem>
                      {messages.map((message, index) => (
                        <MessageScrollerItem
                          className="flex flex-col gap-5"
                          key={`preview-${index}`}
                          messageId={`preview-${index}`}
                          scrollAnchor
                        >
                          <ChatMessageView author="user" primitives={ui}>
                            {message.attached && (
                              <AttachmentCardView
                                primitives={ui}
                                title="project-notes.md"
                                media={<PreviewIcon name="file" />}
                              />
                            )}
                            {message.text && (
                              <Bubble variant="muted">
                                <BubbleContent>
                                  <pre className="font-sans whitespace-pre-wrap">
                                    {message.text}
                                  </pre>
                                </BubbleContent>
                              </Bubble>
                            )}
                          </ChatMessageView>
                          <ChatMessageView author="assistant" primitives={ui}>
                            <Bubble variant="ghost">
                              <BubbleContent>
                                This is a local preview. Your generated app
                                connects to {installation.gateway} to answer
                                your messages.
                              </BubbleContent>
                            </Bubble>
                          </ChatMessageView>
                        </MessageScrollerItem>
                      ))}
                    </MessageScrollerContent>
                  </MessageScrollerViewport>
                  <MessageScrollerButton />
                </MessageScroller>
              </MessageScrollerProvider>
              <footer className="mx-auto w-full max-w-3xl shrink-0 p-4">
                {composer}
              </footer>
            </>
          )}
        </main>
      </SidebarProvider>
    </IconLibraryContext>
  );
  const BaseDirectionProvider = native.DirectionProvider;
  const RadixDirectionProvider = nativeRadix.DirectionProvider;
  return radix ? (
    <RadixDirectionProvider dir={direction}>{content}</RadixDirectionProvider>
  ) : (
    <BaseDirectionProvider direction={direction}>
      {content}
    </BaseDirectionProvider>
  );
};
