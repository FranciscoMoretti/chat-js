"use client";

import type { ChatTransport, UIMessage } from "ai";
import { GitBranch, Send, Square } from "lucide-react";
import { useState } from "react";
import { useThread } from "@/lib/thread/react";
import type { MessageTreeSnapshot } from "@/lib/thread";

export interface ThreadDemoProps {
  initialTree?: MessageTreeSnapshot<UIMessage>;
  transport: ChatTransport<UIMessage>;
}

function getMessageText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
}

export function ThreadDemo({ initialTree, transport }: ThreadDemoProps) {
  const [draft, setDraft] = useState("");
  const chat = useThread({ initialTree, transport });
  const activeIds = new Set(chat.messages.map((message) => message.id));

  async function sendMessage() {
    const text = draft.trim();
    if (!text) {
      return;
    }

    setDraft("");
    await chat.sendMessage({ text });
  }

  function getTreeNodeClass(isCursor: boolean, isActive: boolean) {
    if (isCursor) {
      return "border-foreground bg-foreground text-background";
    }
    if (isActive) {
      return "border-foreground/25 bg-background";
    }
    return "border-border bg-background/50 hover:bg-background";
  }

  return (
    <div className="grid min-h-[36rem] overflow-hidden border bg-background lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="flex min-h-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div>
            <h2 className="font-medium text-sm">Active conversation</h2>
            <p className="text-muted-foreground text-xs">
              Cursor: {chat.tree.cursorId ?? "root"}
            </p>
          </div>
          <span className="font-mono text-muted-foreground text-xs">
            {chat.status}
          </span>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {chat.messages.length === 0 ? (
            <p className="mx-auto max-w-sm py-16 text-center text-muted-foreground text-sm">
              Send a message to begin a thread.
            </p>
          ) : (
            chat.messages.map((message) => (
              <article
                className={
                  message.role === "user"
                    ? "ml-auto max-w-[80%] bg-primary px-4 py-3 text-primary-foreground"
                    : "max-w-[88%] border-border border-l-2 px-4 py-1"
                }
                key={message.id}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] uppercase opacity-70">
                  <span>{message.role}</span>
                  <span className="font-mono normal-case">{message.id}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {getMessageText(message) || "Streaming..."}
                </p>
              </article>
            ))
          )}
        </div>

        <form
          className="flex items-end gap-2 border-t p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            await sendMessage();
          }}
        >
          <textarea
            aria-label="Message"
            className="min-h-10 flex-1 resize-none border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Message this branch"
            rows={1}
            value={draft}
          />
          {chat.status === "streaming" || chat.status === "submitted" ? (
            <button
              aria-label="Stop response"
              className="grid size-10 place-items-center bg-primary text-primary-foreground"
              onClick={async () => {
                await chat.stop();
              }}
              type="button"
            >
              <Square className="size-4" />
            </button>
          ) : (
            <button
              aria-label="Send message"
              className="grid size-10 place-items-center bg-primary text-primary-foreground disabled:opacity-40"
              disabled={!draft.trim()}
              type="submit"
            >
              <Send className="size-4" />
            </button>
          )}
        </form>
      </section>

      <aside className="min-h-0 border-t bg-muted/30 lg:border-t-0 lg:border-l">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div>
            <h2 className="font-medium text-sm">Message tree</h2>
            <p className="text-muted-foreground text-xs">
              Select any node to branch
            </p>
          </div>
          <GitBranch className="size-4 text-muted-foreground" />
        </header>

        <div className="overflow-auto p-4">
          <div className="space-y-2">
            {Object.values(chat.tree.messagesById).map((message) => {
              const parentId = chat.tree.parentById[message.id];
              const depth = chat.tree.getPath(message.id).length - 1;
              const isActive = activeIds.has(message.id);
              const isCursor = chat.tree.cursorId === message.id;

              return (
                <button
                  className={`flex w-full items-center gap-2 border px-2.5 py-2 text-left text-xs transition-colors ${getTreeNodeClass(isCursor, isActive)}`}
                  key={message.id}
                  onClick={() => chat.tree.setCursor(message.id)}
                  style={{ marginLeft: `${Math.min(depth, 6) * 12}px` }}
                  type="button"
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {message.role}: {getMessageText(message) || "Streaming"}
                    </span>
                    <span className="block truncate font-mono opacity-60">
                      {parentId ? `after ${parentId}` : "root"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
