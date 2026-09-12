"use client";

import { getMessageText } from "@chat-js/thread";
import type { ThreadRunHandle } from "@chat-js/thread";
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
import { useEffect, useMemo, useRef, useState } from "react";

import {
  buildTreeLayout,
  initialTree,
  PlaygroundTransport,
} from "./thread-playground-model";
import type {
  PlaygroundChat as ThreadChat,
  PlaygroundMessage,
} from "./thread-playground-model";

import styles from "./thread-showcase.module.css";

const INSTALL_COMMAND = "bun add @chat-js/thread";
const MAX_ACTIVE_RUNS = 8;

type PlaygroundChat = ThreadChat & { stoppedIds: ReadonlySet<string> };

const responseState = (chat: PlaygroundChat, message: PlaygroundMessage) => {
  if (message.role !== "assistant") {
    return "complete";
  }
  const status = chat.tree.getRunForMessage(message.id)?.status;
  if (status === "streaming" || status === "submitted") {
    return status;
  }
  if (status === "error") {
    return "error";
  }
  if (chat.stoppedIds.has(message.id)) {
    return "stopped";
  }
  return "complete";
};

const ResponseStatus = ({
  chat,
  message,
}: {
  chat: PlaygroundChat;
  message: PlaygroundMessage;
}) => {
  const state = responseState(chat, message);
  const live = state === "streaming" || state === "submitted";
  const tokens = Math.ceil(getMessageText(message).length / 4);
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
      {message.role === "assistant" && (
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

export const ThreadInstallCommand = () => {
  const [copied, setCopied] = useState(false);

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
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
          onClick={copyCommand}
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
  chat: PlaygroundChat;
  draft: string;
  onBranch: (messageId: string) => Promise<void>;
  onDraftChange: (draft: string) => void;
  onResponseCountChange: (count: number) => void;
  onSend: () => Promise<void>;
  playgroundError: string | null;
  responseCount: number;
}) => {
  const transcript = useRef<HTMLDivElement>(null);
  const followTranscript = useRef(true);
  useEffect(() => {
    const element = transcript.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (followTranscript.current) {
        element.scrollTop = element.scrollHeight;
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { cursorId } = chat.tree;
  const textLength = chat.messages.reduce(
    (length, message) => length + getMessageText(message).length,
    0
  );
  useEffect(() => {
    if (textLength && followTranscript.current) {
      transcript.current?.scrollTo({
        behavior: "instant",
        top: transcript.current.scrollHeight,
      });
    }
  }, [textLength]);
  useEffect(() => {
    followTranscript.current = true;
    if (cursorId) {
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
        onScroll={(event) => {
          const element = event.currentTarget;
          followTranscript.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            80;
        }}
        ref={transcript}
      >
        {chat.messages.map((message) => {
          const isUser = message.role === "user";
          const siblings = chat.tree.getSiblings(message.id);
          const siblingIndex = siblings.findIndex(
            (sibling) => sibling.id === message.id
          );
          const hasSiblings = siblings.length > 1 && siblingIndex !== -1;

          const navigateToSibling = (nextIndex: number) => {
            const sibling = siblings[nextIndex];
            if (!sibling) {
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
              {!isUser && <ResponseStatus chat={chat} message={message} />}
              <div className={styles.messageActions}>
                <button
                  className={styles.branchButton}
                  disabled={chat.tree.activeRuns.length >= MAX_ACTIVE_RUNS}
                  onClick={async () => {
                    await onBranch(message.id);
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
                      onClick={() => navigateToSibling(siblingIndex - 1)}
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
                      onClick={() => navigateToSibling(siblingIndex + 1)}
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
        onSubmit={async (event) => {
          event.preventDefault();
          await onSend();
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
            onChange={(event) => onDraftChange(event.target.value)}
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
                onChange={(event) =>
                  onResponseCountChange(Number(event.target.value))
                }
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
                onClick={() => chat.stop()}
                title="Stop selected response"
                type="button"
              >
                Stop selected
              </button>
              <button
                aria-label="Stop all responses"
                className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-8 place-items-center disabled:opacity-30"
                disabled={chat.tree.activeRuns.length === 0}
                onClick={() => chat.tree.stopAll()}
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

const TreeCanvas = ({ chat }: { chat: PlaygroundChat }) => {
  const layout = useMemo(
    () =>
      buildTreeLayout({
        childrenByParentId: chat.tree.childrenByParentId,
        rootIds: chat.tree.rootIds,
      }),
    [chat.tree.childrenByParentId, chat.tree.rootIds]
  );
  const activeIds = new Set(chat.messages.map((message) => message.id));
  const canvas = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState({ height: 0, width: 0 });
  useEffect(() => {
    const viewport = canvas.current;
    if (!viewport) {
      return;
    }
    const observer = new ResizeObserver(() =>
      setViewportSize({
        height: viewport.clientHeight,
        width: viewport.clientWidth,
      })
    );
    observer.observe(viewport);
    return () => observer.disconnect();
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
            if (!message) {
              return null;
            }
            const isActive = activeIds.has(node.id);
            const isCursor = chat.tree.cursorId === node.id;
            const state = responseState(chat, message);

            return (
              <button
                aria-pressed={isCursor}
                className={styles.treeNode}
                data-node-id={node.id}
                data-path={isActive}
                data-state={state}
                key={node.id}
                onClick={() => chat.tree.setCursor(node.id)}
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
                  <ResponseStatus chat={chat} message={message} />
                ) : (
                  <span className={styles.promptLabel}>
                    Prompt{isActive ? " · on selected path" : ""}
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

const PlaygroundSession = () => {
  const [draft, setDraft] = useState("");
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);
  const [responseCount, setResponseCount] = useState(1);
  const idCounter = useRef(100);

  const generateMessageId = () => {
    idCounter.current += 1;
    return `msg_${idCounter.current}`;
  };

  const [stoppedIds, setStoppedIds] = useState<ReadonlySet<string>>(new Set());
  const thread = useThread<PlaygroundMessage>({
    concurrency: { maxActiveRuns: MAX_ACTIVE_RUNS },
    generateId: generateMessageId,
    initialTree,
    onFinish: ({ message, isAbort }) => {
      if (isAbort) {
        setStoppedIds((previous) => new Set([...previous, message.id]));
      }
    },
    transport: new PlaygroundTransport(),
  });
  const chat: PlaygroundChat = { ...thread, stoppedIds };

  const messageInput = (text: string, title: string, messageId?: string) => ({
    messageId,
    metadata: {
      activeStreamId: null,
      createdAt: new Date().toISOString(),
      title,
    },
    text,
  });

  const sendDraft = async (text = draft.trim(), count = responseCount) => {
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
        Array.from({ length: count - 1 }, (_, index) =>
          chat.tree.startRun({
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
      await Promise.all([
        primaryRun.finished,
        ...siblingRuns.map((run) => run.finished),
      ]);
    } catch (error) {
      setPlaygroundError(
        error instanceof Error ? error.message : "Unable to start this response"
      );
    }
  };

  const branchFrom = async (messageId: string) => {
    setPlaygroundError(null);
    try {
      const message = chat.tree.messagesById[messageId];
      if (!message) {
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
          onClick={() => sendDraft("How should we launch this?", 3)}
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
          onSend={() => sendDraft()}
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

export const ThreadPlayground = () => {
  const [session, setSession] = useState(0);
  return (
    <div>
      <PlaygroundSession key={session} />
      <div className={styles.demoFooter}>
        <span>
          Local simulation · ≈ token counts are estimates, not provider usage
        </span>
        <button onClick={() => setSession((value) => value + 1)} type="button">
          <RotateCcw size={12} /> Reset demo
        </button>
      </div>
    </div>
  );
};

export const ThreadShowcase = () => (
  <>
    <ThreadPlayground />
    <ThreadInstallCommand />
  </>
);
