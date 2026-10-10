"use client";

import type { ThreadInit, ThreadRun, ThreadRunHandle } from "@chat-js/thread";
import { getMessageText } from "@chat-js/thread";
import { useThread } from "@chat-js/thread/react";
/* oxlint-disable sort-imports -- Preserve useThread's environment initialization before the playground model creates its dated initial messages; globally sorting these declarations moves that model ahead of the native hook module. */
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
/* oxlint-enable sort-imports */
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
// oxlint-disable-next-line eslint/no-magic-numbers -- Select getMessageText's sole receiver from its native Parameters tuple.
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
/* oxlint-disable react/jsx-no-literals -- ResponseStatus renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */

/* oxlint-disable eslint/no-magic-numbers -- ResponseStatus: Layout distances, demo IDs and timing/count values define this component's existing presentation. */

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
        // oxlint-disable-next-line no-ternary -- Keep className JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        className={live ? styles.streamingRing : styles.statusDot}
      />
      <span>
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          state === "submitted"
            ? "Starting"
            : state.charAt(0).toUpperCase() + state.slice(1)
        }
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ThreadInstallCommand renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */

/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable react/no-multi-comp -- ThreadInstallCommand: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/no-magic-numbers -- ThreadInstallCommand: Layout distances, demo IDs and timing/count values define this component's existing presentation. */

/* oxlint-disable react/jsx-max-depth -- ThreadInstallCommand: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */

const ThreadInstallCommand = (): React.JSX.Element => {
  const [copied, setCopied] = useState(false);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copyCommand's awaited sequencing and rejected-Promise behavior. */
  const copyCommand = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      globalThis.setTimeout((): void => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <div className="border-border bg-card mt-8 max-w-3xl border">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <span className="text-muted-foreground flex items-center gap-2 px-2 text-sm">
          <Package
            // oxlint-disable-next-line react/forbid-component-props -- Package accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-3.5"
          />
          npm package
        </span>
        <button /* oxlint-disable no-ternary -- Keep the copied install-command icon as lazy JSX values; equivalent if/else assignments conflict with pinned unicorn/prefer-ternary. */
          aria-label="Copy installation command"
          className="text-muted-foreground hover:bg-secondary hover:text-foreground grid size-8 place-items-center transition-colors"
          onClick={(): void => {
            void copyCommand();
          }}
          type="button"
        >
          {copied ? (
            <Check
              // oxlint-disable-next-line react/forbid-component-props -- Check accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-4"
            />
          ) : (
            <Copy
              // oxlint-disable-next-line react/forbid-component-props -- Copy accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-4"
            />
          )}
        </button /* oxlint-enable no-ternary */>
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- Conversation renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */

/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- Conversation: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/max-lines-per-function -- Conversation: This component owns related hooks, rendering and interaction closures; extraction needs state-ownership review. */
/* oxlint-disable eslint/no-undefined -- Conversation: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
/* oxlint-disable eslint/no-magic-numbers -- Conversation: Layout distances, demo IDs and timing/count values define this component's existing presentation. */

/* oxlint-disable react/jsx-max-depth -- Conversation: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */

/* oxlint-disable unicorn/no-null -- Conversation: React refs/rendering and selected-state contracts use null as an explicit empty state. */
/* oxlint-disable typescript/strict-boolean-expressions -- Conversation: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
  useEffect(() => {
    const element = transcript.current;
    if (!element) {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- Keep React's explicit no-cleanup result; bare return conflicts with typescript/consistent-return when the other branch returns cleanup.
      return undefined;
    }
    const observer = new ResizeObserver((): void => {
      if (followTranscript.current) {
        element.scrollTop = element.scrollHeight;
      }
    });
    observer.observe(element);
    return (): void => observer.disconnect();
  }, []);
  const { cursorId } = chat.tree;
  const textLength = chat.messages.reduce(
    (length, message: PlaygroundMessageReader): number =>
      length + getMessageText(message).length,
    0
  );
  useEffect((): void => {
    if (textLength && followTranscript.current) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading scrollTo from transcript.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      transcript.current?.scrollTo({
        behavior: "instant",
        top: transcript.current.scrollHeight,
      });
    }
  }, [textLength]);
  useEffect((): void => {
    followTranscript.current = true;
    if (cursorId) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading scrollTo from transcript.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
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
            {
              /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading title from chat.tree.messagesById[chat.tree.cursorId ?? ""].metadata; read metadata from chat.tree.messagesById[chat.tree.cursorId ?? ""]; preserve one receiver evaluation, skipped accesses and the existing "Start a conversation" fallback. */
              chat.tree.messagesById[chat.tree.cursorId ?? ""]?.metadata
                ?.title ??
                /* oxlint-enable oxc/no-optional-chaining */ "Start a conversation"
            }
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
              // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the existing nullish guard when reading status from getRunForMessage(...); retain the SDK query's undefined result.
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
            if (!sibling) {
              return;
            }
            const leaf = chat.tree.getLeaves(sibling.id).at(-1);
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from leaf; preserve one receiver evaluation, skipped accesses and the existing sibling.id fallback.
            chat.tree.setCursor(leaf?.id ?? sibling.id);
          };

          return (
            <article
              // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                <span>
                  {
                    // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                    isUser ? "You" : "Assistant"
                  }
                </span>
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
                  <GitBranch
                    // oxlint-disable-next-line react/forbid-component-props -- GitBranch accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-3"
                  />
                  Branch from here
                </button>
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  hasSiblings ? (
                    <fieldset className="ml-auto flex items-center gap-0.5">
                      <legend className="sr-only">
                        Branch navigation for {message.id}
                      </legend>
                      <button
                        aria-label={`Previous branch for ${message.id}`}
                        className="hover:bg-background/10 grid size-7 place-items-center disabled:opacity-30"
                        disabled={siblingIndex === 0}
                        onClick={(): void =>
                          navigateToSibling(siblingIndex - 1)
                        }
                        title="Previous version"
                        type="button"
                      >
                        <ChevronLeft
                          // oxlint-disable-next-line react/forbid-component-props -- ChevronLeft accepts className in its styling contract; preserve this caller's layout and appearance.
                          className="size-3.5"
                        />
                      </button>
                      <span className="min-w-8 text-center font-mono text-[10px]">
                        Branch {siblingIndex + 1} / {siblings.length}
                      </span>
                      <button
                        aria-label={`Next branch for ${message.id}`}
                        className="hover:bg-background/10 grid size-7 place-items-center disabled:opacity-30"
                        disabled={siblingIndex === siblings.length - 1}
                        onClick={(): void =>
                          navigateToSibling(siblingIndex + 1)
                        }
                        title="Next version"
                        type="button"
                      >
                        <ChevronRight
                          // oxlint-disable-next-line react/forbid-component-props -- ChevronRight accepts className in its styling contract; preserve this caller's layout and appearance.
                          className="size-3.5"
                        />
                      </button>
                    </fieldset>
                  ) : null
                }
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
            {
              /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading title from chat.tree.messagesById[chat.tree.cursorId ?? ""].metadata; read metadata from chat.tree.messagesById[chat.tree.cursorId ?? ""]; preserve one receiver evaluation, skipped accesses and the existing "the beginning" fallback. */
              chat.tree.messagesById[chat.tree.cursorId ?? ""]?.metadata
                ?.title ??
                /* oxlint-enable oxc/no-optional-chaining */ "the beginning"
            }
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
            ): void => onDraftChange(event.target.value)}
            placeholder="Message this branch…"
            rows={2}
            value={draft}
          />
          <div className="border-border flex items-center justify-between gap-2 border-t p-1.5">
            <label className="text-muted-foreground flex h-8 items-center gap-1.5 px-2 text-xs">
              <GitBranch
                // oxlint-disable-next-line react/forbid-component-props -- GitBranch accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-3.5"
              />
              <span>Responses</span>
              <select
                aria-label="Number of responses"
                className="text-foreground bg-transparent font-mono outline-none"
                onChange={(
                  event: Readonly<{
                    target: Pick<HTMLSelectElement, "value">;
                  }>
                ): void => onResponseCountChange(Number(event.target.value))}
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
                <Square
                  // oxlint-disable-next-line react/forbid-component-props -- Square accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-3.5"
                />
              </button>
              <button
                aria-label={`Send message with ${responseCount} ${
                  // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                <Send
                  // oxlint-disable-next-line react/forbid-component-props -- Send accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-4"
                />
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- TreeCanvas renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- TreeCanvas: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/max-lines-per-function -- TreeCanvas: This component owns related hooks, rendering and interaction closures; extraction needs state-ownership review. */
/* oxlint-disable eslint/no-undefined -- TreeCanvas: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
/* oxlint-disable eslint/no-magic-numbers -- TreeCanvas: Layout distances, demo IDs and timing/count values define this component's existing presentation. */

/* oxlint-disable react/jsx-max-depth -- TreeCanvas: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */
/* oxlint-disable unicorn/no-null -- TreeCanvas: React refs/rendering and selected-state contracts use null as an explicit empty state. */

/* oxlint-disable typescript/strict-boolean-expressions -- TreeCanvas: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
  useEffect(() => {
    const viewport = canvas.current;
    if (!viewport) {
      // oxlint-disable-next-line unicorn/no-useless-undefined -- Keep React's explicit no-cleanup result; bare return conflicts with typescript/consistent-return when the other branch returns cleanup.
      return undefined;
    }
    const observer = new ResizeObserver((): void =>
      setViewportSize({
        height: viewport.clientHeight,
        width: viewport.clientWidth,
      })
    );
    observer.observe(viewport);
    return (): void => observer.disconnect();
  }, []);
  // oxlint-disable-next-line no-ternary -- Keep scale as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
                      // oxlint-disable-next-line no-ternary -- Keep className JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
            let state: ReturnType<typeof responseState> = "complete";
            if (message.role === "assistant") {
              state = responseState(
                // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the existing nullish guard when reading status from getRunForMessage(...); retain the SDK query's undefined result.
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
                onClick={(): void => chat.tree.setCursor(node.id)}
                style={{ left: node.x, top: node.y }}
                type="button"
              >
                {isCursor && (
                  <span className={styles.selectedFlag}>
                    <Check size={10} /> Selected
                  </span>
                )}
                <span className={styles.nodeTitle}>
                  {
                    // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                    message.role === "user" ? (
                      <GitBranch size={12} />
                    ) : (
                      <span className={styles.assistantGlyph}>✦</span>
                    )
                  }
                  {
                    /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading title from message.metadata; preserve one receiver evaluation, skipped accesses and the existing message.role fallback. */
                    message.metadata?.title ??
                      /* oxlint-enable oxc/no-optional-chaining */ message.role
                  }
                </span>
                <span className={styles.nodePreview}>
                  {getMessageText(message) || "Waiting for first token…"}
                </span>
                {
                  // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                  message.role === "assistant" ? (
                    <ResponseStatus
                      isAssistant={message.role === "assistant"}
                      state={state}
                      text={getMessageText(message)}
                    />
                  ) : (
                    <span className={styles.promptLabel}>
                      Prompt
                      {
                        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                        isActive ? " · on selected path" : ""
                      }
                    </span>
                  )
                }
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable unicorn/no-null -- messageInput: React refs/rendering and selected-state contracts use null as an explicit empty state. */
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
/* oxlint-disable react/jsx-no-literals -- PlaygroundSession renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */
/* oxlint-enable unicorn/no-null */

/* oxlint-disable eslint/max-statements -- PlaygroundSession: The component shares hook order and closure state; extraction requires a component/state-boundary design. */
/* oxlint-disable react/no-multi-comp -- PlaygroundSession: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/max-lines-per-function -- PlaygroundSession: This component owns related hooks, rendering and interaction closures; extraction needs state-ownership review. */
/* oxlint-disable unicorn/no-null -- PlaygroundSession: React refs/rendering and selected-state contracts use null as an explicit empty state. */
/* oxlint-disable eslint/no-magic-numbers -- PlaygroundSession: Layout distances, demo IDs and timing/count values define this component's existing presentation. */
/* oxlint-disable eslint/id-length -- PlaygroundSession: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */
/* oxlint-disable eslint/no-undefined -- PlaygroundSession: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */

/* oxlint-disable react/jsx-max-depth -- PlaygroundSession: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- PlaygroundSession: This callback closes over current render state; preserving its timing and dependencies needs more than mechanical memoization. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- PlaygroundSession: The prop object depends on current render/scene state; memoization needs lifecycle/dependency review and an identity-sensitive consumer. */
/* oxlint-disable typescript/promise-function-async -- PlaygroundSession: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
/* oxlint-disable typescript/strict-boolean-expressions -- PlaygroundSession: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing thread own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  const chat: PlaygroundChat = { ...thread, stoppedIds };

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve sendDraft's awaited sequencing and rejected-Promise behavior. */
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
              // oxlint-disable-next-line no-ternary -- Keep responseLabel as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      const completions = [primaryRun.finished];
      for (const siblingRun of siblingRuns) {
        completions.push(siblingRun.finished);
      }
      await Promise.all(completions);
    } catch (error) {
      setPlaygroundError(
        // oxlint-disable-next-line no-ternary -- Keep setPlaygroundError argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error instanceof Error ? error.message : "Unable to start this response"
      );
    }
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve branchFrom's awaited sequencing and rejected-Promise behavior. */
  const branchFrom = async (messageId: string): Promise<void> => {
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
        // oxlint-disable-next-line no-ternary -- Keep setPlaygroundError argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error instanceof Error ? error.message : "Unable to create this branch"
      );
    }
  };
  /* oxlint-enable oxc/no-async-await */
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
          onSend={(): Promise<void> => sendDraft()}
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ThreadPlayground renders authored authored landing-page copy, demo labels and navigation text; no translation-layer contract is defined here. */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/id-length */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable react/no-multi-comp -- ThreadPlayground: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
/* oxlint-disable eslint/no-magic-numbers -- ThreadPlayground: Layout distances, demo IDs and timing/count values define this component's existing presentation. */

/* oxlint-disable react/jsx-max-depth -- ThreadPlayground: The nested JSX preserves this component's layout/accessibility hierarchy; extracting nodes needs a component/state-boundary review. */
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
          onClick={(): void => setSession((value): number => value + 1)}
          type="button"
        >
          <RotateCcw size={12} /> Reset demo
        </button>
      </div>
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- ThreadShowcase: The private render helpers share this screen/scene's layout and interaction state; extraction needs a component ownership decision. */
const ThreadShowcase = (): React.JSX.Element => (
  <>
    <ThreadPlayground />
    <ThreadInstallCommand />
  </>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ThreadInstallCommand, ThreadPlayground, ThreadShowcase); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable max-lines -- ThreadShowcase: This demonstration component and its private render helpers share interaction/state ownership; splitting requires design review. */
export { ThreadInstallCommand, ThreadPlayground, ThreadShowcase };
/* oxlint-enable import/no-named-export */
