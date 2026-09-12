"use client";

import type { ComponentProps } from "react";
import { createContext, useContext, useMemo } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface ChatLayoutContextValue {
  isSecondaryPanelVisible: boolean;
}

const ChatLayoutContext = createContext<ChatLayoutContextValue | null>(null);

const useChatLayoutContext = () => {
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

export const ChatLayout = ({
  className,
  children,
  isSecondaryPanelVisible = false,
  ...props
}: ChatLayoutProps) => {
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

export const ChatLayoutMain = ({
  className,
  defaultSize = 65,
  minSize = 40,
  ...props
}: ChatLayoutMainProps) => {
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

export const ChatLayoutSecondary = ({
  defaultSize = 35,
  minSize = 25,
  ...props
}: ChatLayoutSecondaryProps) => {
  const { isSecondaryPanelVisible } = useChatLayoutContext();

  if (!isSecondaryPanelVisible) {
    return null;
  }

  return (
    <ResizablePanel defaultSize={defaultSize} minSize={minSize} {...props} />
  );
};

type ChatLayoutHandleProps = ComponentProps<typeof ResizableHandle>;

export const ChatLayoutHandle = ({
  className,
  withHandle = true,
  ...props
}: ChatLayoutHandleProps) => {
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
