"use client";

import React, { createContext, useContext, useMemo } from "react";
import type { ComponentProps } from "react";

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
/* oxlint-disable unicorn/no-null -- ChatLayoutContext: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ChatLayoutContext = createContext<ChatLayoutContextValue | null>(null);
/* oxlint-enable unicorn/no-null */

/* oxlint-disable typescript/explicit-function-return-type -- useChatLayoutContext: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const useChatLayoutContext = () => {
  const context = useContext(ChatLayoutContext);
  if (!context) {
    throw new Error("ChatLayout components must be used within <ChatLayout />");
  }
  return context;
};
/* oxlint-enable typescript/explicit-function-return-type */

type ChatLayoutProps = Omit<
  ComponentProps<typeof ResizablePanelGroup>,
  "direction"
> & {
  isSecondaryPanelVisible?: boolean;
};
/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ChatLayout: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

type ChatLayoutMainProps = ComponentProps<typeof ResizablePanel>;
/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ChatLayoutMain: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 65); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

type ChatLayoutSecondaryProps = ComponentProps<typeof ResizablePanel>;
/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ChatLayoutSecondary: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 35); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

type ChatLayoutHandleProps = ComponentProps<typeof ResizableHandle>;
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ChatLayoutHandle: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
