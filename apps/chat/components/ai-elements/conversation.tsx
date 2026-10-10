"use client";

import React, { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import { ArrowDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ConversationProps = ComponentProps<typeof StickToBottom>;

const Conversation = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ConversationProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <StickToBottom
    // oxlint-disable-next-line react/forbid-component-props -- StickToBottom accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("relative flex-1 overflow-y-hidden", className)}
    initial="smooth"
    resize="smooth"
    role="log"
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Conversation's StickToBottom prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);

type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

/* oxlint-disable react/no-multi-comp -- ConversationContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ConversationContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ConversationContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <StickToBottom.Content
    // oxlint-disable-next-line react/forbid-component-props -- StickToBottom.Content accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("flex flex-col gap-8 p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ConversationContent's StickToBottom.Content prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/strict-boolean-expressions -- ConversationEmptyState: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including icon). */

const ConversationEmptyState = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    title = "No messages yet",
    description = "Start a conversation to see messages here",
    icon,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, title, description, icon, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ConversationEmptyStateProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "flex size-full flex-col items-center justify-center gap-3 p-8 text-center",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ConversationEmptyState's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/strict-boolean-expressions */

type ConversationScrollButtonProps = ComponentProps<typeof Button>;

/* oxlint-disable react/no-multi-comp -- Keep the scroll control beside Conversation because it consumes the shared stick-to-bottom context and is exported through the existing conversation module. */

const ConversationScrollButton = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ConversationScrollButtonProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): false | React.JSX.Element => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    void scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <Button
        // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn(
          "absolute bottom-4 left-[50%] translate-x-[-50%] rounded-full",
          className
        )}
        onClick={handleScrollToBottom}
        size="icon"
        type="button"
        variant="outline"
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ConversationScrollButton's Button prop contract, preserving caller options, children and callbacks.
        {...props}
      >
        <ArrowDownIcon
          // oxlint-disable-next-line react/forbid-component-props -- ArrowDownIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
        />
      </Button>
    )
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */
export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ConversationContentProps, ConversationEmptyStateProps, ConversationProps, ConversationScrollButtonProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type {
  ConversationContentProps,
  ConversationEmptyStateProps,
  ConversationProps,
  ConversationScrollButtonProps,
};
/* oxlint-enable import/no-named-export */
