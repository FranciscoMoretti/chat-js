import type { ComponentType, ReactNode } from "react";

/** Message chrome shared by the app and sample transcripts. Parts stay caller-owned. */
export const ChatMessageView = ({
  author,
  messageId,
  children,
  actions,
  followUp,
  primitives,
}: {
  readonly author: "user" | "assistant";
  readonly messageId?: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
  readonly followUp?: ReactNode;
  readonly primitives: {
    Message: ComponentType<{
      children?: ReactNode;
      align: "start" | "end";
      className?: string;
    }>;
    MessageContent: ComponentType<{ children?: ReactNode }>;
  };
}) => (
  <primitives.Message
    align={author === "user" ? "end" : "start"}
    className="py-1"
    data-eve-message-id={messageId}
    data-role={author}
  >
    <primitives.MessageContent>
      {author === "assistant" && <span className="sr-only">Assistant</span>}
      {children}
      {actions}
      {followUp}
    </primitives.MessageContent>
  </primitives.Message>
);
