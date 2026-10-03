"use client";

import { ArrowDownIcon } from "lucide-react";
import React, { useCallback } from "react";
import type { ComponentProps } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/* oxlint-disable import/group-exports -- ConversationProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type ConversationProps = ComponentProps<typeof StickToBottom>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Conversation: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ConversationProps). */

export const Conversation = ({
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
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- ConversationContentProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type ConversationContentProps = ComponentProps<
  typeof StickToBottom.Content
>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ConversationContent: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ConversationContentProps). */

export const ConversationContent = ({
  className,
  ...props
}: ConversationContentProps): React.JSX.Element => (
  <StickToBottom.Content
    className={cn("flex flex-col gap-8 p-4", className)}
    {...props}
  />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- ConversationEmptyStateProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
};
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ConversationEmptyState: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including icon). */

export const ConversationEmptyState = ({
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
/* oxlint-enable import/group-exports, react/jsx-max-depth, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports -- ConversationScrollButtonProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type ConversationScrollButtonProps = ComponentProps<typeof Button>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ConversationScrollButton: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ConversationScrollButtonProps). */

export const ConversationScrollButton = ({
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
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
