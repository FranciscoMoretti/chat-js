"use client";

/**
 * This is a modified version of the Conversation component that avoids overscrolling and uses a shadcn scroll area.
 * Can be added to AI Elements if the shadcn scroll area PR is merged.
 * Undo after this PR is merged: https://github.com/shadcn-ui/ui/pull/8925/files
 */

import type { ComponentProps } from "react";
import { useStickToBottomContext } from "use-stick-to-bottom";
import type { StickToBottom } from "use-stick-to-bottom";

import { ScrollArea } from "@/components/ui/extra/scroll-area-viewport-ref";
import { cn } from "@/lib/utils";

type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export const ConversationContent = ({
  className,
  children,
  ...props
}: ConversationContentProps) => {
  const context = useStickToBottomContext();

  return (
    <ScrollArea
      className={cn(
        "h-full w-full",
        // Avoid overscroll with page down
        "*:data-radix-scroll-area-viewport:contain-strict",
        // Radix injects an inner wrapper: <Viewport><div style='min-width: 100%; display: table;'></div></Viewport>
        // Force it to behave like a normal block and allow shrinking to avoid horizontal overflow.
        "[&_[data-slot=scroll-area-viewport]>div]:block!",
        "[&_[data-slot=scroll-area-viewport]>div]:min-w-0!",
        "[&_[data-slot=scroll-area-viewport]>div]:max-w-full"
      )}
      viewportRef={context.scrollRef}
    >
      <div
        {...props}
        className={cn("flex flex-col gap-8 p-4", className)}
        ref={context.contentRef}
      >
        {typeof children === "function" ? children(context) : children}
      </div>
    </ScrollArea>
  );
};
