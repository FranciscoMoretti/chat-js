"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import React, { createContext, useContext, useMemo } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

interface ChatLayoutContextValue {
  isSecondaryPanelVisible: boolean;
}
/* oxlint-disable unicorn/no-null -- ChatLayoutContext: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutContext = createContext<ChatLayoutContextValue | null>(null);
/* oxlint-enable unicorn/no-null */

const useChatLayoutContext = (): ChatLayoutContextValue => {
  const context = useContext(ChatLayoutContext);
  if (!context) {
    throw new Error("ChatLayout components must be used within <ChatLayout />");
  }
  return context;
};

type ChatLayoutProps = Omit<
  ComponentProps<typeof ResizablePanelGroup>,
  "direction"
> & {
  isSecondaryPanelVisible?: boolean;
};
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- ChatLayout: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ChatLayout = ({
  className,
  children,
  isSecondaryPanelVisible = false,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children, isSecondaryPanelVisible from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ChatLayoutProps): ReactJSX.Element => {
  const { state: sidebarState } = useSidebar();
  const contextValue = useMemo(
    () => ({ isSecondaryPanelVisible }),
    [isSecondaryPanelVisible]
  );

  return (
    <ChatLayoutContext.Provider value={contextValue}>
      <ResizablePanelGroup
        // oxlint-disable-next-line react/forbid-component-props -- ResizablePanelGroup accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn(
          "bg-background @container flex h-dvh max-h-dvh w-full max-w-screen min-w-0 flex-col md:max-w-[calc(100vw-var(--sidebar-width))]",
          sidebarState === "collapsed" && "md:max-w-screen",
          className
        )}
        direction="horizontal"
        {...props}
      >
        {children}
      </ResizablePanelGroup>
    </ChatLayoutContext.Provider>
  );
};
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

type ChatLayoutMainProps = ComponentProps<typeof ResizablePanel>;
/* oxlint-disable no-magic-numbers, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ChatLayoutMain: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 65); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ChatLayoutMain = ({
  className,
  defaultSize = 65,
  minSize = 40,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, defaultSize, minSize from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ChatLayoutMainProps): React.JSX.Element => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  return (
    <ResizablePanel
      // oxlint-disable-next-line react/forbid-component-props -- ResizablePanel accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(isSecondaryPanelVisible && "hidden md:block", className)}
      defaultSize={defaultSize}
      minSize={minSize}
      {...props}
    />
  );
};
/* oxlint-enable no-magic-numbers, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ChatLayoutSecondaryProps = ComponentProps<typeof ResizablePanel>;
/* oxlint-disable no-magic-numbers, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ChatLayoutSecondary: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 35); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutSecondary = ({
  defaultSize = 35,
  minSize = 25,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes defaultSize, minSize from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ChatLayoutSecondaryProps): React.JSX.Element | null => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  if (!isSecondaryPanelVisible) {
    return null;
  }

  return (
    <ResizablePanel defaultSize={defaultSize} minSize={minSize} {...props} />
  );
};
/* oxlint-enable no-magic-numbers, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */

type ChatLayoutHandleProps = ComponentProps<typeof ResizableHandle>;
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ChatLayoutHandle: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutHandle = ({
  className,
  withHandle = true,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, withHandle from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ChatLayoutHandleProps): React.JSX.Element | null => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  if (!isSecondaryPanelVisible) {
    return null;
  }

  return (
    <ResizableHandle
      // oxlint-disable-next-line react/forbid-component-props -- ResizableHandle accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("hidden md:flex", className)}
      withHandle={withHandle}
      {...props}
    />
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ChatLayout, ChatLayoutHandle, ChatLayoutMain, ChatLayoutSecondary); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */
export { ChatLayout, ChatLayoutHandle, ChatLayoutMain, ChatLayoutSecondary };
/* oxlint-enable import/no-named-export */
