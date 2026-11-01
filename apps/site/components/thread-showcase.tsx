"use client";

import type { ThreadInit, ThreadRun, ThreadRunHandle } from "@chat-js/thread";
import { getMessageText } from "@chat-js/thread";
import { useThread } from "@chat-js/thread/react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  GitBranch,
  Package,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import type {
  PlaygroundMessage,
  PlaygroundChat as ThreadChat,
} from "./thread-playground-model";
import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  buildTreeLayout,
  createPlaygroundTransport,
  initialTree,
} from "./thread-playground-model";

import styles from "./thread-showcase.module.css";

const INSTALL_COMMAND = "bun add @chat-js/thread";
const MAX_ACTIVE_RUNS = 8;

type PlaygroundChat = ThreadChat & { stoppedIds: ReadonlySet<string> };

type PlaygroundChatView = Readonly<{
  messages: readonly PlaygroundMessageReader[];
  status: PlaygroundChat["status"];
  stop: PlaygroundChat["stop"];
  stoppedIds: Readonly<Pick<ReadonlySet<string>, "has">>;
  tree: Readonly<{
    activeRuns: Readonly<{ length: number }>;
    childrenByParentId: Readonly<Record<string, readonly string[]>>;
    cursorId: string | null;
    getLeaves: (id?: string | null) => readonly PlaygroundMessageReader[];
    getRunForMessage: (
      id: string
    ) => Readonly<Pick<ThreadRun, "status">> | undefined;
    getSiblings: (id: string) => readonly PlaygroundMessageReader[];
    messagesById: Readonly<Record<string, PlaygroundMessageReader>>;
    rootIds: readonly string[];
    setCursor: PlaygroundChat["tree"]["setCursor"];
    stopAll: PlaygroundChat["tree"]["stopAll"];
  }>;
}>;
type ReadonlyStringIterable = Readonly<{
  [Symbol.iterator]: () => Readonly<{
    next: () => Readonly<IteratorResult<string>>;
  }>;
}>;

type ThreadFinishEvent = Parameters<
  NonNullable<ThreadInit<PlaygroundMessage>["onFinish"]>
>["0"];
type PlaygroundMessageReader = Parameters<typeof getMessageText>[0] &
  Readonly<Pick<PlaygroundMessage, "metadata">>;

const responseState = (
  status: ThreadRun["status"] | undefined,
  isStopped: boolean
): "complete" | "error" | "stopped" | "streaming" | "submitted" => {
  if (status === "streaming" || status === "submitted") {
    return status;
  }
  if (status === "error") {
    return "error";
  }
  if (isStopped) {
    return "stopped";
  }
  return "complete";
};

const ResponseStatus = ({
  isAssistant,
  state,
  text,
}: {
  readonly isAssistant: boolean;
  readonly state: ReturnType<typeof responseState>;
  readonly text: string;
}): React.JSX.Element => {
  const live = state === "streaming" || state === "submitted";
  const tokens = Math.ceil(text.length / 4);
  return (
    <span className={styles.responseStatus} data-state={state}>
      <span
        aria-hidden="true"
        className={live ? styles.streamingRing : styles.statusDot}
      />
      <span>
        {state === "submitted"
          ? "Starting"
          : state.charAt(0).toUpperCase() + state.slice(1)}
      </span>
      {isAssistant && (
        <span
          className={styles.tokens}
          title="Estimated tokens: text length divided by four"
        >
          ≈{tokens} tok
        </span>
      )}
    </span>
  );
};

const ThreadInstallCommand = (): React.JSX.Element => {
  const [copied, setCopied] = useState(false);

  const copyCommand = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      globalThis.setTimeout((): void => {
        setCopied(false);
      }, 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="border-border bg-card mt-8 max-w-3xl border">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground flex items-center gap-2 px-2 text-sm">
          <Package className="size-3.5" />
          npm package
        </span>
        <button
          aria-label="Copy installation command"
          className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-8 place-items-center transition-colors"
          onClick={(): void => {
            void copyCommand();
          }}
          type="button"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <div className="overflow-x-auto px-4 py-4">
        <code className="font-mono text-sm whitespace-nowrap">
          <span className="text-muted-foreground select-none">$ </span>
          {INSTALL_COMMAND}
        </code>
      </div>
    </div>
  );
};

const Conversation = ({
  chat,
  draft,
  onBranch,
  onDraftChange,
  onResponseCountChange,
  onSend,
  playgroundError,
  responseCount,
}: {
  readonly chat: PlaygroundChatView;
  readonly draft: string;
  readonly onBranch: (messageId: string) => Promise<void>;
  readonly onDraftChange: (draft: string) => void;
  readonly onResponseCountChange: (count: number) => void;
  readonly onSend: () => Promise<void>;
  readonly playgroundError: string | null;
  readonly responseCount: number;
}): React.JSX.Element => {
  const transcript = useRef<HTMLDivElement>(null);
  const followTranscript = useRef(true);
  useEffect((): (() => void) | undefined => {
    const element = transcript.current;
    if (!element) {
      return undefined;
    }
    const observer = new ResizeObserver((): void => {
      if (followTranscript.current) {
        element.scrollTop = element.scrollHeight;
      }
    });
    observer.observe(element);
    return (): void => {
      observer.disconnect();
    };
  }, []);
  const { cursorId } = chat.tree;
  const textLength = chat.messages.reduce(
    (length, message: PlaygroundMessageReader): number =>
      length + getMessageText(message).length,
    0
  );
  useEffect((): void => {
    if (textLength && followTranscript.current) {
      transcript.current?.scrollTo({
        behavior: "instant",
        top: transcript.current.scrollHeight,
      });
    }
  }, [textLength]);
  useEffect((): void => {
    followTranscript.current = true;
    if (typeof cursorId === "string" && cursorId !== "") {
      transcript.current?.scrollTo({
        behavior: "instant",
        top: transcript.current.scrollHeight,
      });
    }
  }, [cursorId]);

  return (
    <section className={styles.conversation}>
      <header className="border-border flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
        <div>
          <p className="text-sm font-medium">Chat</p>
          <p className="text-muted-foreground font-mono text-[11px]">
            {chat.tree.messagesById[chat.tree.cursorId ?? ""]?.metadata
              ?.title ?? "Start a conversation"}
          </p>
        </div>
        <span className={styles.viewingBadge}>
          <span /> Viewing this path
        </span>
      </header>

      <div
        className={styles.transcript}
        onScroll={(
          event: Readonly<{
            currentTarget: Pick<
              HTMLDivElement,
              "clientHeight" | "scrollHeight" | "scrollTop"
            >;
          }>
        ): void => {
          const element = event.currentTarget;
          followTranscript.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
        ref={transcript}
      >
        {chat.messages.map((message: PlaygroundMessageReader) => {
          const isUser = message.role === "user";
          let state: ReturnType<typeof responseState> = "complete";
          if (message.role === "assistant") {
            state = responseState(
              chat.tree.getRunForMessage(message.id)?.status,
              chat.stoppedIds.has(message.id)
            );
          }
          const siblings = chat.tree.getSiblings(message.id);
          const siblingIndex = siblings.findIndex(
            (sibling: Readonly<Pick<PlaygroundMessage, "id">>): boolean =>
              sibling.id === message.id
          );
          const hasSiblings = siblings.length > 1 && siblingIndex !== -1;

          const navigateToSibling = (nextIndex: number): void => {
            const sibling = siblings[nextIndex];
            if (sibling === undefined) {
              return;
            }
            const leaf = chat.tree.getLeaves(sibling.id).at(-1);
            chat.tree.setCursor(leaf?.id ?? sibling.id);
          };

          return (
            <article
              className={`${styles.message} ${isUser ? styles.userMessage : styles.assistantMessage}`}
              data-selected={chat.tree.cursorId === message.id}
              key={message.id}
            >
              <div className={styles.messageAuthor}>
                {!isUser && (
                  <span aria-hidden="true" className={styles.assistantAvatar}>
                    <Sparkles size={14} />
                  </span>
                )}
                <span>{isUser ? "You" : "Assistant"}</span>
                {chat.tree.cursorId === message.id && (
                  <span className={styles.currentTurn}>Selected</span>
                )}
              </div>
              <div className={styles.messageBody}>
                <p className="text-sm leading-6 whitespace-pre-wrap">
                  {getMessageText(message) || "Streaming..."}
                </p>
              </div>
              {!isUser && (
                <ResponseStatus
                  isAssistant={message.role === "assistant"}
                  state={state}
                  text={getMessageText(message)}
                />
              )}
              <div className={styles.messageActions}>
                <button
                  className={styles.branchButton}
                  disabled={chat.tree.activeRuns.length >= MAX_ACTIVE_RUNS}
                  onClick={(): void => {
                    void onBranch(message.id);
                  }}
                  type="button"
                >
                  <GitBranch className="size-3" />
                  Branch from here
                </button>
                {hasSiblings ? (
                  <fieldset className="ml-auto flex items-center gap-0.5">
                    <legend className="sr-only">
                      Branch navigation for {message.id}
                    </legend>
                    <button
                      aria-label={`Previous branch for ${message.id}`}
                      className="hover:bg-background/10 grid size-7 place-items-center disabled:opacity-30"
                      disabled={siblingIndex === 0}
                      onClick={(): void => {
                        navigateToSibling(siblingIndex - 1);
                      }}
                      title="Previous version"
                      type="button"
                    >
                      <ChevronLeft className="size-3.5" />
                    </button>
                    <span className="min-w-8 text-center font-mono text-[10px]">
                      Branch {siblingIndex + 1} / {siblings.length}
                    </span>
                    <button
                      aria-label={`Next branch for ${message.id}`}
                      className="hover:bg-background/10 grid size-7 place-items-center disabled:opacity-30"
                      disabled={siblingIndex === siblings.length - 1}
                      onClick={(): void => {
                        navigateToSibling(siblingIndex + 1);
                      }}
                      title="Next version"
                      type="button"
                    >
                      <ChevronRight className="size-3.5" />
                    </button>
                  </fieldset>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <form
        className="border-border border-t p-3"
        onSubmit={(
          event: Readonly<Pick<React.FormEvent, "preventDefault">>
        ): void => {
          event.preventDefault();
          void onSend();
        }}
      >
        <p className={styles.composerContext}>
          <GitBranch size={12} /> Continuing from{" "}
          <strong>
            {chat.tree.messagesById[chat.tree.cursorId ?? ""]?.metadata
              ?.title ?? "the beginning"}
          </strong>
        </p>
        <div className="border-border focus-within:border-foreground/40 rounded-lg border">
          <textarea
            aria-label="Message this branch"
            className="block min-h-16 w-full resize-none bg-transparent px-3 py-3 text-sm outline-none"
            onChange={(
              event: Readonly<{
                target: Pick<HTMLTextAreaElement, "value">;
              }>
            ): void => {
              onDraftChange(event.target.value);
            }}
            placeholder="Message this branch…"
            rows={2}
            value={draft}
          />
          <div className="border-border flex items-center justify-between gap-2 border-t p-1.5">
            <label className="text-muted-foreground flex h-8 items-center gap-1.5 px-2 text-xs">
              <GitBranch className="size-3.5" />
              <span>Responses</span>
              <select
                aria-label="Number of responses"
                className="text-foreground bg-transparent font-mono outline-none"
                onChange={(
                  event: Readonly<{
                    target: Pick<HTMLSelectElement, "value">;
                  }>
                ): void => {
                  onResponseCountChange(Number(event.target.value));
                }}
                value={responseCount}
              >
                {[1, 2, 3, 4].map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center gap-1.5">
              <button
                aria-label="Stop selected response"
                className="text-muted-foreground hover:bg-secondary hover:text-foreground h-8 rounded-md px-2 text-xs disabled:opacity-30"
                disabled={
                  chat.status !== "submitted" && chat.status !== "streaming"
                }
                onClick={(): void => {
                  void chat.stop();
                }}
                title="Stop selected response"
                type="button"
              >
                Stop selected
              </button>
              <button
                aria-label="Stop all responses"
                className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-8 place-items-center disabled:opacity-30"
                disabled={chat.tree.activeRuns.length === 0}
                onClick={(): void => {
                  void chat.tree.stopAll();
                }}
                title="Stop all responses"
                type="button"
              >
                <Square className="size-3.5" />
              </button>
              <button
                aria-label={`Send message with ${responseCount} ${
                  responseCount === 1 ? "response" : "responses"
                }`}
                className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-md disabled:opacity-40"
                disabled={
                  !draft.trim() ||
                  chat.tree.activeRuns.length + responseCount > MAX_ACTIVE_RUNS
                }
                title="Send message"
                type="submit"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
        <p
          aria-live="polite"
          className="min-h-5 pt-1.5 text-xs text-red-600 dark:text-red-400"
        >
          {playgroundError}
        </p>
      </form>
    </section>
  );
};

const TreeCanvas = ({
  chat,
}: {
  readonly chat: PlaygroundChatView;
}): React.JSX.Element => {
  const layout = useMemo(
    () =>
      buildTreeLayout({
        childrenByParentId: chat.tree.childrenByParentId,
        rootIds: chat.tree.rootIds,
      }),
    [chat.tree.childrenByParentId, chat.tree.rootIds]
  );
  const activeIds = new Set(
    chat.messages.map(
      (message: Readonly<Pick<PlaygroundMessage, "id">>): string => message.id
    )
  );
  const canvas = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ height: 0, width: 0 });
  useEffect((): (() => void) | undefined => {
    const viewport = canvas.current;
    if (!viewport) {
      return undefined;
    }
    const observer = new ResizeObserver((): void => {
      setViewportSize({
        height: viewport.clientHeight,
        width: viewport.clientWidth,
      });
    });
    observer.observe(viewport);
    return (): void => {
      observer.disconnect();
    };
  }, []);
  const scale = viewportSize.width
    ? Math.max(
        0.75,
        Math.min(
          1,
          (viewportSize.width - 24) / layout.width,
          (viewportSize.height - 24) / layout.height
        )
      )
    : 1;

  return (
    <div className={styles.treeScroll} ref={canvas}>
      <div
        style={{
          height: layout.height * scale + 24,
          position: "relative",
          width: Math.max(viewportSize.width, layout.width * scale + 24),
        }}
      >
        <div
          className="absolute"
          style={{
            height: layout.height,
            left: Math.max(12, (viewportSize.width - layout.width * scale) / 2),
            top: 12,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            width: layout.width,
          }}
        >
          <svg
            aria-hidden="true"
            className="text-border absolute inset-0"
            height={layout.height}
            width={layout.width}
          >
            {layout.nodes.flatMap((node) => {
              const children = chat.tree.childrenByParentId[node.id] ?? [];
              return children.map((childId) => {
                const child = layout.positions.get(childId);
                if (!child) {
                  return null;
                }
                return (
                  <path
                    className={
                      activeIds.has(childId) ? styles.selectedEdge : styles.edge
                    }
                    d={`M${node.x} ${node.y + 43} C${node.x} ${node.y + 65}, ${child.x} ${child.y - 65}, ${child.x} ${child.y - 43}`}
                    fill="none"
                    key={`${node.id}-${childId}`}
                    stroke="currentColor"
                  />
                );
              });
            })}
          </svg>

          {layout.nodes.map((node) => {
            const message = chat.tree.messagesById[node.id];
            if (message === undefined) {
              return null;
            }
            const isActive = activeIds.has(node.id);
            const isCursor = chat.tree.cursorId === node.id;
            let state: ReturnType<typeof responseState> = "complete";
            if (message.role === "assistant") {
              state = responseState(
                chat.tree.getRunForMessage(message.id)?.status,
                chat.stoppedIds.has(message.id)
              );
            }

            return (
              <button
                aria-pressed={isCursor}
                className={styles.treeNode}
                data-node-id={node.id}
                data-path={isActive}
                data-state={state}
                key={node.id}
                onClick={(): void => {
                  chat.tree.setCursor(node.id);
                }}
                style={{ left: node.x, top: node.y }}
                type="button"
              >
                {isCursor && (
                  <span className={styles.selectedFlag}>
                    <Check size={10} /> Selected
                  </span>
                )}
                <span className={styles.nodeTitle}>
                  {message.role === "user" ? (
                    <GitBranch size={12} />
                  ) : (
                    <span className={styles.assistantGlyph}>✦</span>
                  )}
                  {message.metadata?.title ?? message.role}
                </span>
                <span className={styles.nodePreview}>
                  {getMessageText(message) || "Waiting for first token…"}
                </span>
                {message.role === "assistant" ? (
                  <ResponseStatus
                    isAssistant={message.role === "assistant"}
                    state={state}
                    text={getMessageText(message)}
                  />
                ) : (
                  <span className={styles.promptLabel}>
                    Prompt
                    {isActive ? " · on selected path" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const messageInput = (
  text: string,
  title: string,
  messageId?: string
): {
  messageId: string | undefined;
  metadata: {
    activeStreamId: null;
    createdAt: string;
    title: string;
  };
  text: string;
} => ({
  messageId,
  metadata: {
    activeStreamId: null,
    createdAt: new Date().toISOString(),
    title,
  },
  text,
});

const PlaygroundSession = (): React.JSX.Element => {
  const [draft, setDraft] = useState("");
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [responseCount, setResponseCount] = useState(1);
  const idCounter = useRef(100);

  const generateMessageId = (): string => {
    idCounter.current += 1;
    return `msg_${idCounter.current}`;
  };

  const [stoppedIds, setStoppedIds] = useState<ReadonlySet<string>>(new Set());
  const thread = useThread<PlaygroundMessage>({
    concurrency: { maxActiveRuns: MAX_ACTIVE_RUNS },
    generateId: generateMessageId,
    initialTree,
    onFinish: ({
      message,
      isAbort,
    }: Readonly<{
      message: Readonly<Pick<ThreadFinishEvent["message"], "id">>;
      isAbort: boolean;
    }>): void => {
      if (isAbort) {
        setStoppedIds(
          (previous: ReadonlyStringIterable) =>
            new Set([...previous, message.id])
        );
      }
    },
    transport: createPlaygroundTransport(),
  });
  const chat: PlaygroundChat = { ...thread, stoppedIds };

  const sendDraft = async (
    input?: string,
    count = responseCount
  ): Promise<void> => {
    const text = input ?? draft.trim();
    if (!text) {
      return;
    }
    setPlaygroundError(null);
    try {
      const userMessageId = generateMessageId();
      const primaryRun = await chat.tree.startRun({
        message: messageInput(text, "Playground message", userMessageId),
        request: {
          body: {
            responseLabel:
              count === 1 ? "Assistant reply" : `Response 1 of ${count}`,
          },
        },
      });
      setDraft("");

      const siblingRuns: ThreadRunHandle[] = await Promise.all(
        Array.from(
          { length: count - 1 },
          async (_, index) =>
            await chat.tree.startRun({
              follow: false,
              from: userMessageId,
              request: {
                body: {
                  responseLabel: `Response ${index + 2} of ${count}`,
                },
              },
            })
        )
      );
      const completions = [primaryRun.finished];
      for (const siblingRun of siblingRuns) {
        completions.push(siblingRun.finished);
      }
      await Promise.all(completions);
    } catch (error) {
      setPlaygroundError(
        error instanceof Error ? error.message : "Unable to start this response"
      );
    }
  };
  const branchFrom = async (messageId: string): Promise<void> => {
    setPlaygroundError(null);
    try {
      const message = chat.tree.messagesById[messageId];
      if (message === undefined) {
        return;
      }
      chat.tree.setCursor(messageId);
      if (message.role === "user") {
        await chat.sendMessage(undefined, {
          body: { responseLabel: "Alternative response" },
        });
        return;
      }
      await chat.sendMessage(
        messageInput(
          `Take another direction from ${messageId}.`,
          "Branch prompt"
        ),
        { body: { responseLabel: "Branch response" } }
      );
    } catch (error) {
      setPlaygroundError(
        error instanceof Error ? error.message : "Unable to create this branch"
      );
    }
  };
  return (
    <div className={styles.playground} data-testid="thread-playground">
      <div className="border-border flex min-h-16 flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className={styles.playgroundTitle}>
            <span className={styles.brandGlyph}>✦</span> One conversation. Every
            possibility.
          </p>
          <p className="text-muted-foreground text-xs">
            Real tree state with simulated local streams
          </p>
        </div>
        <button
          className={styles.demoButton}
          disabled={chat.tree.activeRuns.length + 3 > MAX_ACTIVE_RUNS}
          onClick={(): void => {
            void sendDraft("How should we launch this?", 3);
          }}
          type="button"
        >
          <Play fill="currentColor" size={13} /> Run 3 replies
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Conversation
          chat={chat}
          draft={draft}
          onBranch={branchFrom}
          onDraftChange={setDraft}
          onResponseCountChange={setResponseCount}
          onSend={sendDraft}
          playgroundError={playgroundError}
          responseCount={responseCount}
        />
        <aside className={styles.treePanel}>
          <header className="border-border flex min-h-16 items-center justify-between border-b px-5 py-3">
            <div>
              <p className="text-sm font-medium">Conversation map</p>
              <p className="text-muted-foreground font-mono text-[11px]">
                Click a card to follow its path
              </p>
            </div>
            <span className={styles.viewingBadge}>
              {chat.tree.activeRuns.length} streaming
            </span>
          </header>
          <div className={styles.legend}>
            <span>
              <i className={styles.legendSelected} /> Selected path
            </span>
            <span>
              <i className={styles.streamingRing} /> Streaming
            </span>
            <span>
              <i className={styles.statusDot} /> Complete
            </span>
          </div>
          <TreeCanvas chat={chat} />
          <p className={styles.mapHint}>
            Explore freely. Hidden branches keep streaming.{" "}
            <span>Scroll to explore the tree</span>
          </p>
        </aside>
      </div>
    </div>
  );
};

const ThreadPlayground = (): React.JSX.Element => {
  const [session, setSession] = useState(0);
  return (
    <div>
      <PlaygroundSession key={session} />
      <div className={styles.demoFooter}>
        <span>
          Local simulation · ≈ token counts are estimates, not provider usage
        </span>
        <button
          onClick={(): void => {
            setSession((value): number => value + 1);
          }}
          type="button"
        >
          <RotateCcw size={12} /> Reset demo
        </button>
      </div>
    </div>
  );
};

const ThreadShowcase = (): React.JSX.Element => (
  <>
    <ThreadPlayground />
    <ThreadInstallCommand />
  </>
);

export { ThreadInstallCommand, ThreadPlayground, ThreadShowcase };
