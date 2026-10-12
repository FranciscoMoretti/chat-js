"use client";

import { hasCustomContent } from "@/components/custom-content";

import React, { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ConversationProps = ComponentProps<typeof StickToBottom>;

const Conversation = ({
  className,
  ...props
}: ConversationProps): React.JSX.Element => (
  <StickToBottom
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps): React.JSX.Element => (
  <StickToBottom.Content
    className={cn("flex flex-col gap-8 p-4", className)}
    {...props}
  />
);

type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

const ConversationEmptyState = ({
  className,
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps): React.JSX.Element => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    {...props}
  >
    {children ?? (
      <>
        {hasCustomContent(icon) ? (
          <div className="text-muted-foreground">{icon}</div>
        ) : (
          icon
        )}
        <div className="space-y-1">
          <h3 className="text-sm font-medium">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

type ConversationScrollButtonProps = ComponentProps<typeof Button>;

const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps): false | React.JSX.Element => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </Button>
    )
  );
};
export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
};
export type {
  ConversationContentProps,
  ConversationEmptyStateProps,
  ConversationProps,
  ConversationScrollButtonProps,
};
