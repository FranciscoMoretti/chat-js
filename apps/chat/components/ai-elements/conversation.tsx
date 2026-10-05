"use client";

import { ArrowDownIcon } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { useCallback } from "react";
/* oxlint-enable sort-imports */
import type { ComponentProps } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConversationProps = ComponentProps<typeof StickToBottom>;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Conversation: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ConversationProps). */

const Conversation = ({
  className,
  ...props
}: ConversationProps): React.JSX.Element => (
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ConversationContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ConversationContentProps). */

const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps): React.JSX.Element => (
  <StickToBottom.Content
    // oxlint-disable-next-line react/forbid-component-props -- StickToBottom.Content accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("flex flex-col gap-8 p-4", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ConversationContent's StickToBottom.Content prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ConversationEmptyState: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including icon). */

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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

type ConversationScrollButtonProps = ComponentProps<typeof Button>;

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ConversationScrollButton: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ConversationScrollButtonProps). */

const ConversationScrollButton = ({
  className,
  ...props
}: ConversationScrollButtonProps) => {
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
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
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
