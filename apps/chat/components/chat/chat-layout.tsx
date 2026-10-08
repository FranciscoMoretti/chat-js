"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import React, { createContext, useContext, useMemo } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

import { useSidebar } from "@/components/ui/sidebar";

const MAIN_PANEL_DEFAULT_PERCENT = 65;
const MAIN_PANEL_MIN_PERCENT = 40;
const SECONDARY_PANEL_DEFAULT_PERCENT = 35;
const SECONDARY_PANEL_MIN_PERCENT = 25;

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
/* oxlint-disable react/jsx-props-no-spreading -- Forward the native ResizablePanelGroup props, including refs, keyboard handlers and accessibility attributes, through this layout boundary. */

const ChatLayout = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    isSecondaryPanelVisible = false,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children, isSecondaryPanelVisible from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ChatLayoutProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
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
/* oxlint-enable react/jsx-props-no-spreading */

type ChatLayoutMainProps = ComponentProps<typeof ResizablePanel>;
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp -- ChatLayoutMain: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 65); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ChatLayoutMain = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    defaultSize = MAIN_PANEL_DEFAULT_PERCENT,
    minSize = MAIN_PANEL_MIN_PERCENT,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, defaultSize, minSize from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ChatLayoutMainProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
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
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp */

type ChatLayoutSecondaryProps = ComponentProps<typeof ResizablePanel>;
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, unicorn/no-null -- ChatLayoutSecondary: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 35); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutSecondary = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    defaultSize = SECONDARY_PANEL_DEFAULT_PERCENT,
    minSize = SECONDARY_PANEL_MIN_PERCENT,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes defaultSize, minSize from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ChatLayoutSecondaryProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element | null => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  if (!isSecondaryPanelVisible) {
    return null;
  }

  return (
    <ResizablePanel defaultSize={defaultSize} minSize={minSize} {...props} />
  );
};
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, unicorn/no-null */

type ChatLayoutHandleProps = ComponentProps<typeof ResizableHandle>;
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, unicorn/no-null -- ChatLayoutHandle: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutHandle = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    withHandle = true,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, withHandle from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ChatLayoutHandleProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element | null => {
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
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, unicorn/no-null */
export { ChatLayout, ChatLayoutHandle, ChatLayoutMain, ChatLayoutSecondary };
/* oxlint-enable import/no-named-export */
