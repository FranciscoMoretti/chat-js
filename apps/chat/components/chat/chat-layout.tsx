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

const ChatLayoutContext = createContext<ChatLayoutContextValue | null>(null);

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

const ChatLayout = ({
  className,
  children,
  isSecondaryPanelVisible = false,
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

type ChatLayoutMainProps = ComponentProps<typeof ResizablePanel>;

const ChatLayoutMain = ({
  className,
  defaultSize = MAIN_PANEL_DEFAULT_PERCENT,
  minSize = MAIN_PANEL_MIN_PERCENT,
  ...props
}: ChatLayoutMainProps): React.JSX.Element => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  return (
    <ResizablePanel
      className={cn(isSecondaryPanelVisible && "hidden md:block", className)}
      defaultSize={defaultSize}
      minSize={minSize}
      {...props}
    />
  );
};

type ChatLayoutSecondaryProps = ComponentProps<typeof ResizablePanel>;

const ChatLayoutSecondary = ({
  defaultSize = SECONDARY_PANEL_DEFAULT_PERCENT,
  minSize = SECONDARY_PANEL_MIN_PERCENT,
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

type ChatLayoutHandleProps = ComponentProps<typeof ResizableHandle>;

const ChatLayoutHandle = ({
  className,
  withHandle = true,
  ...props
}: ChatLayoutHandleProps): React.JSX.Element | null => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  if (!isSecondaryPanelVisible) {
    return null;
  }

  return (
    <ResizableHandle
      className={cn("hidden md:flex", className)}
      withHandle={withHandle}
      {...props}
    />
  );
};
export { ChatLayout, ChatLayoutHandle, ChatLayoutMain, ChatLayoutSecondary };
