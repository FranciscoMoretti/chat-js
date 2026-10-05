"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { BrainIcon, ChevronDownIcon } from "lucide-react";
/* oxlint-enable sort-imports */
import type { ComponentProps, JSX as ReactJSX } from "react";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Response } from "./response";
/* oxlint-enable sort-imports */
import { Shimmer } from "./shimmer";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
}
/* oxlint-disable unicorn/no-null -- ReasoningContext: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ReasoningContext = createContext<ReasoningContextValue | null>(null);
/* oxlint-enable unicorn/no-null */

const useReasoning = (): ReasoningContextValue => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;
/* oxlint-disable max-lines-per-function, typescript/prefer-readonly-parameter-types, unicorn/no-null -- Reasoning: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    // oxlint-disable-next-line typescript/unbound-method -- #613: onOpenChange is a React callback supplied through component props, not an object method relying on a receiver.
    onOpenChange,
    duration: durationProp,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      defaultProp: defaultOpen,
      onChange: onOpenChange,
      prop: open,
    });
    const [duration, setDuration] = useControllableState({
      defaultProp: 0,
      prop: durationProp,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming starts and ends
    useEffect(() => {
      if (isStreaming) {
        if (startTime === null) {
          // oxlint-disable-next-line react/set-state-in-effect -- Capture the external stream start timestamp.
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration]);

    // Auto-open when streaming starts, auto-close when streaming ends (once only)
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    useEffect(() => {
      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        // Add a small delay before closing to allow user to see the content
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return (): void => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = useCallback(
      (newOpen: boolean) => {
        setIsOpen(newOpen);
      },
      [setIsOpen]
    );
    const contextValue = useMemo(
      () => ({ duration, isOpen, isStreaming, setIsOpen }),
      [duration, isOpen, isStreaming, setIsOpen]
    );

    return (
      <ReasoningContext.Provider value={contextValue}>
        <Collapsible
          // oxlint-disable-next-line react/forbid-component-props -- Collapsible accepts className in its styling contract; preserve this caller's layout and appearance.
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Reasoning's Collapsible prop contract, preserving caller options, children and callbacks.
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);
/* oxlint-enable max-lines-per-function, typescript/prefer-readonly-parameter-types, unicorn/no-null */

type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;
/* oxlint-disable react/jsx-no-literals -- getThinkingMessage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, no-undefined -- getThinkingMessage: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const getThinkingMessage = (
  isStreaming: boolean,
  duration?: number
): ReactJSX.Element => {
  if (isStreaming) {
    return <Shimmer duration={1}>Thinking...</Shimmer>;
  }
  if (duration === undefined || duration === 0) {
    return <p>Thought for a few seconds</p>;
  }
  return <p>Thought for {duration} seconds</p>;
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, no-undefined */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ReasoningTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ReasoningTriggerProps). */

const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration } = useReasoning();

    return (
      <CollapsibleTrigger
        // oxlint-disable-next-line react/forbid-component-props -- CollapsibleTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn(
          "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors",
          className
        )}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ReasoningTrigger's CollapsibleTrigger prop contract, preserving caller options, children and callbacks.
        {...props}
      >
        {children ?? (
          <>
            <BrainIcon
              // oxlint-disable-next-line react/forbid-component-props -- BrainIcon accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-4"
            />
            {getThinkingMessage(isStreaming, duration)}
            <ChevronDownIcon
              // oxlint-disable-next-line react/forbid-component-props -- ChevronDownIcon accepts className in its styling contract; preserve this caller's layout and appearance.
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string;
};

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ReasoningContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ReasoningContentProps). */

const ReasoningContent = memo(
  ({
    className,
    children,
    ...props
  }: ReasoningContentProps): React.JSX.Element => (
    <CollapsibleContent
      // oxlint-disable-next-line react/forbid-component-props -- CollapsibleContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "mt-4 text-sm",
        "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
        className
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ReasoningContent's CollapsibleContent prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <Response
        // oxlint-disable-next-line react/forbid-component-props -- Response accepts className in its styling contract; preserve this caller's layout and appearance.
        className="grid gap-2"
      >
        {children}
      </Response>
    </CollapsibleContent>
  )
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Reasoning, ReasoningContent, ReasoningTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Reasoning, ReasoningContent, ReasoningTrigger };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReasoningContentProps, ReasoningProps, ReasoningTriggerProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ReasoningContentProps, ReasoningProps, ReasoningTriggerProps };
/* oxlint-enable import/no-named-export */
