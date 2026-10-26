"use client";

import { useEffect, useState } from "react";
import { decodePreset, DEFAULT_PRESET_CONFIG } from "shadcn/preset";
import { useTheme } from "next-themes";
import { useDesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params";
import { usePresetCode } from "@/vendor/shadcn-create/hooks/use-design-system";
import { installationSelectionSchema } from "../../../../packages/registry/installation";
import { PromptForm } from "../../../chat/components/composer/prompt-form";
import { ToolActivity } from "../../../chat/components/part/tool-activity";
import { ToolOutput } from "../../../chat/components/part/tool-data";
import { startingInstallation } from "../create-model";
import { IconLibraryContext, PreviewIcon } from "./icons";
import { native } from "./ui/native";
import { native as nativeRadix } from "./ui/native-radix";
import "../../app/create/preview/preview.css";

export const ChatPreview = () => {
  const [params, setParams] = useDesignSystemSearchParams();
  const code = usePresetCode();
  const preset = decodePreset(code) ?? DEFAULT_PRESET_CONFIG;
  const { resolvedTheme, setTheme } = useTheme();
  const mode = resolvedTheme === "dark" ? "dark" : "light";
  const [installation, setInstallation] = useState(startingInstallation);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
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
  const direction = params.rtl ? "rtl" : "ltr";
  const ui = radix ? nativeRadix[preset.style] : native[preset.style];
  const menu = ui.menus[preset.menuColor];
  const BaseDropdownMenuTrigger =
    native[preset.style].menus[preset.menuColor].DropdownMenuTrigger;
  const RadixDropdownMenuTrigger =
    nativeRadix[preset.style].menus[preset.menuColor].DropdownMenuTrigger;
  const {
    Button,
    CodeBlock,
    CodeBlockHeader,
    CodeBlockTitle,
    CodeBlockActions,
    CodeBlockCopyButton,
    CodeBlockContent,
    InputGroup,
    InputGroupTextarea,
    InputGroupAddon,
    InputGroupButton,
    Message,
    MessageContent,
    Bubble,
    BubbleContent,
    Attachment,
    AttachmentMedia,
    AttachmentContent,
    AttachmentTitle,
    AttachmentDescription,
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
  } = menu;

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
    if (!text) {
      return;
    }
    setMessages((previous) => [...previous, text]);
    setDraft("");
    setAttached(false);
  };

  const content = (
    <IconLibraryContext value={preset.iconLibrary}>
      <div
        className="create-chat-preview bg-background text-foreground flex h-dvh min-h-0 w-full text-sm"
        data-testid="chat-preview"
        data-base={params.base}
        data-preset={code}
        data-style={preset.style}
        data-icons={preset.iconLibrary}
        data-mode={mode}
      >
        <aside className="bg-sidebar text-sidebar-foreground border-sidebar-border hidden w-52 shrink-0 flex-col gap-5 border-e p-4 min-[760px]:flex">
          <div className="flex items-center gap-2 px-2 py-2 font-semibold">
            <PreviewIcon name="chat" />
            ChatJS
          </div>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              selectScene("preview");
              setMessages([]);
              setDraft("");
              setAttached(false);
              setNotice("Started a new preview conversation.");
            }}
          >
            <PreviewIcon name="plus" />
            New chat
          </Button>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground px-2 text-xs">Today</span>
            <Button variant="secondary" className="justify-start">
              Building something good
            </Button>
            <Button
              variant="ghost"
              className="justify-start"
              onClick={() => {
                setNotice("This preview keeps one sample conversation.");
              }}
            >
              Weekend reading list
            </Button>
          </div>
          <div className="mt-auto flex items-center gap-3 px-2">
            <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-full text-xs font-medium">
              YO
            </div>
            <div>
              <p className="font-medium">Your workspace</p>
              <p className="text-muted-foreground text-xs">Personal account</p>
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:px-6">
            <span className="font-medium">Building something good</span>
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
          <MessageScrollerProvider
            key={params.item}
            autoScroll
            defaultScrollPosition="end"
          >
            <MessageScroller className="flex-1">
              <MessageScrollerViewport>
                <MessageScrollerContent className="mx-auto w-full max-w-3xl gap-7 px-5 py-8 sm:px-8">
                  <MessageScrollerItem messageId="sample-scene">
                    {view === "New chat" && messages.length === 0 && (
                      <div className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
                        <PreviewIcon name="chat" className="size-8" />
                        <h1 className="font-heading text-2xl font-semibold tracking-tight">
                          What can we build together?
                        </h1>
                        <p className="text-muted-foreground max-w-sm">
                          Start with a question, an idea, or something you would
                          like to understand.
                        </p>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setDraft("Help me plan my next project");
                          }}
                        >
                          Plan my next project
                        </Button>
                      </div>
                    )}
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
                        <Message align="end">
                          <MessageContent>
                            <Bubble variant="muted">
                              <BubbleContent>
                                Help me build a small app people will love.
                              </BubbleContent>
                            </Bubble>
                          </MessageContent>
                        </Message>
                        <Message align="start">
                          <MessageContent>
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
                                      Your colors, your typography, your way of
                                      working.
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
                          </MessageContent>
                        </Message>
                        {uploads && (
                          <Message align="end">
                            <MessageContent>
                              <Attachment>
                                <AttachmentMedia>
                                  <PreviewIcon name="file" />
                                </AttachmentMedia>
                                <AttachmentContent>
                                  <AttachmentTitle>
                                    project-notes.md
                                  </AttachmentTitle>
                                  <AttachmentDescription>
                                    4 KB · sample attachment
                                  </AttachmentDescription>
                                </AttachmentContent>
                              </Attachment>
                            </MessageContent>
                          </Message>
                        )}
                      </div>
                    )}
                  </MessageScrollerItem>
                  {messages.map((message, index) => (
                    <MessageScrollerItem
                      className="flex flex-col gap-5"
                      key={`${index}-${message}`}
                      messageId={`preview-${index}`}
                      scrollAnchor
                    >
                      <Message align="end">
                        <MessageContent>
                          <Bubble variant="muted">
                            <BubbleContent>{message}</BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                      <Message align="start">
                        <MessageContent>
                          <Bubble variant="ghost">
                            <BubbleContent>
                              This is a local preview. Your generated app
                              connects to {installation.gateway} to answer your
                              messages.
                            </BubbleContent>
                          </Bubble>
                        </MessageContent>
                      </Message>
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
          <footer className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-4 sm:px-8">
            <PromptForm
              primitives={{ InputGroup, InputGroupAddon }}
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
              attachments={
                <>
                  {" "}
                  {attached && uploads && (
                    <InputGroupAddon align="block-start">
                      <PreviewIcon name="file" />
                      <span className="text-xs">project-notes.md</span>
                      <InputGroupButton
                        aria-label="Remove sample attachment"
                        size="icon-xs"
                        onClick={() => {
                          setAttached(false);
                        }}
                      >
                        <PreviewIcon name="close" />
                      </InputGroupButton>
                    </InputGroupAddon>
                  )}
                </>
              }
              tools={
                <>
                  {" "}
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
              actions={
                <InputGroupButton
                  className="ml-auto"
                  variant="default"
                  size="icon-sm"
                  type="submit"
                  aria-label="Send preview message"
                  disabled={!draft.trim()}
                >
                  <PreviewIcon name="up" />
                </InputGroupButton>
              }
            >
              {" "}
              <InputGroupTextarea
                aria-label="Preview message"
                placeholder="Ask anything…"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    send();
                  }
                }}
              />
            </PromptForm>
            <p
              className="text-muted-foreground mt-3 text-center text-[11px]"
              aria-live="polite"
            >
              {notice ||
                `Interactive preview · ${installation.gateway}${uploads ? ` · ${installation.storage?.source} uploads` : ""}`}
            </p>
          </footer>
        </main>
      </div>
    </IconLibraryContext>
  );
  const BaseDirectionProvider = native[preset.style].DirectionProvider;
  const RadixDirectionProvider = nativeRadix[preset.style].DirectionProvider;
  return radix ? (
    <RadixDirectionProvider dir={direction}>{content}</RadixDirectionProvider>
  ) : (
    <BaseDirectionProvider direction={direction}>
      {content}
    </BaseDirectionProvider>
  );
};
