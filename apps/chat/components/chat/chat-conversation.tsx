import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const ChatConversation = ({
  className,
  ...props
}: ComponentProps<"section">) => (
  <section
    data-slot="chat-conversation"
    className={cn("flex h-full min-h-0 flex-col", className)}
    {...props}
  />
);

export const ChatConversationBody = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="chat-conversation-body"
    className={cn("flex min-h-0 flex-1 flex-col", className)}
    {...props}
  />
);

export const ChatConversationFooter = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="chat-conversation-footer"
    className={cn("mx-auto w-full max-w-3xl space-y-3 p-4", className)}
    {...props}
  />
);
