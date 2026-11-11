import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const ChatHeader = ({
  className,
  ...props
}: ComponentProps<"header">) => (
  <header
    data-slot="chat-header"
    className={cn(
      "bg-background sticky top-0 flex items-center justify-between gap-2 px-2 py-1.5 md:px-2",
      className
    )}
    {...props}
  />
);

export const ChatHeaderLeading = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="chat-header-leading"
    className={cn(
      "flex flex-1 items-center justify-between gap-2 overflow-hidden",
      className
    )}
    {...props}
  />
);

export const ChatHeaderTitle = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="chat-header-title"
    className={cn("flex min-w-0 items-center gap-2", className)}
    {...props}
  />
);

export const ChatHeaderActions = ({
  className,
  ...props
}: ComponentProps<"div">) => (
  <div
    data-slot="chat-header-actions"
    className={cn("flex items-center gap-2", className)}
    {...props}
  />
);
