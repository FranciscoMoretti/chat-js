"use client";

import { BrainIcon, ChevronDownIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ComponentProps, JSX as ReactJSX } from "react";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Response } from "./response";
import { Shimmer } from "./shimmer";
import { cn } from "@/lib/utils";
import { useControllableState } from "@radix-ui/react-use-controllable-state";

interface ReasoningContextValue {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number;
}
type ReasoningContextOptions = Readonly<ReasoningContextValue>;

const useReasoningContextValue = ({
  duration,
  isOpen,
  isStreaming,
  setIsOpen,
}: ReasoningContextOptions): ReasoningContextValue =>
  useMemo(
    () => ({ duration, isOpen, isStreaming, setIsOpen }),
    [duration, isOpen, isStreaming, setIsOpen]
  );

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

type ReasoningProps = Omit<
  ComponentProps<typeof Collapsible>,
  "onOpenChange"
> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
};

const useReasoningDisclosure = (
  defaultOpen: boolean,
  onOpenChange: ReasoningProps["onOpenChange"],
  open: ReasoningProps["open"]
): [boolean, React.Dispatch<React.SetStateAction<boolean>>] =>
  useControllableState<boolean>({
    defaultProp: defaultOpen,
    onChange: onOpenChange,
    prop: open,
  });

const useReasoningOpenChange = (
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
): ((open: boolean) => void) =>
  useCallback((newOpen: boolean) => setIsOpen(newOpen), [setIsOpen]);

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;
const NO_RECORDED_REASONING_DURATION = 0;
const THINKING_SHIMMER_DURATION_SECONDS = 1;

const useReasoningDuration = (
  isStreaming: boolean,
  setDuration: (duration: number) => void
): void => {
  /* oxlint-disable unicorn/no-null -- Null marks that no streaming interval has an active start timestamp. */
  const startTime = useRef<number | null>(null);

  useEffect(() => {
    if (isStreaming) {
      const currentStartTime = startTime.current;
      if (currentStartTime === null) {
        startTime.current = Date.now();
      }
    } else if (startTime.current !== null) {
      setDuration(Math.ceil((Date.now() - startTime.current) / MS_IN_S));
      startTime.current = null;
    }
  }, [isStreaming, setDuration]);
  /* oxlint-enable unicorn/no-null */
};

type ReasoningAutoCloseOptions = Readonly<{
  defaultOpen: boolean;
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}>;

const useReasoningAutoClose = ({
  defaultOpen,
  isStreaming,
  isOpen,
  setIsOpen,
}: ReasoningAutoCloseOptions): void => {
  const [hasAutoClosed, setHasAutoClosed] = useState(false);

  // oxlint-disable-next-line typescript/consistent-return -- The effect returns cleanup only when it installed a timer; inactive branches intentionally install no resource.
  useEffect(() => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);

      return (): void => clearTimeout(timer);
    }
  }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);
};

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, isStreaming, open, defaultOpen, onOpenChange, duration, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReasoningProps) => {
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
    const [isOpen, setIsOpen] = useReasoningDisclosure(
      defaultOpen,
      onOpenChange,
      open
    );
    const [duration, setDuration] = useControllableState({
      defaultProp: 0,
      prop: durationProp,
    });

    useReasoningDuration(isStreaming, setDuration);
    useReasoningAutoClose({ defaultOpen, isOpen, isStreaming, setIsOpen });

    const handleOpenChange = useReasoningOpenChange(setIsOpen);
    const contextValue = useReasoningContextValue({
      duration,
      isOpen,
      isStreaming,
      setIsOpen,
    });

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
type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;
/* oxlint-disable react/jsx-no-literals -- getThinkingMessage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-undefined -- getThinkingMessage: undefined means no elapsed duration was supplied. */

const getThinkingMessage = (
  isStreaming: boolean,
  duration?: number
): ReactJSX.Element => {
  if (isStreaming) {
    return (
      <Shimmer duration={THINKING_SHIMMER_DURATION_SECONDS}>
        Thinking...
      </Shimmer>
    );
  }
  if (duration === undefined || duration === NO_RECORDED_REASONING_DURATION) {
    return <p>Thought for a few seconds</p>;
  }
  return <p>Thought for {duration} seconds</p>;
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-undefined */
/* oxlint-disable react/no-multi-comp -- ReasoningTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ReasoningTrigger = memo(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
    {
      className,
      children,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
      ...props
    }: ReasoningTriggerProps
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ) => {
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
                // oxlint-disable-next-line no-ternary -- Keep cn argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                isOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);
/* oxlint-enable react/no-multi-comp */

type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string;
};

/* oxlint-disable react/no-multi-comp -- ReasoningContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Keep this exported component on its existing public prop type; a deep-readonly mapping changes its inferred ComponentProps surface and would alter the public type contract. */
const ReasoningContent = memo(
  ({
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReasoningContentProps): React.JSX.Element => (
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
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
/* oxlint-enable react/no-multi-comp */

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Reasoning, ReasoningContent, ReasoningTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Reasoning, ReasoningContent, ReasoningTrigger };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReasoningContentProps, ReasoningProps, ReasoningTriggerProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ReasoningContentProps, ReasoningProps, ReasoningTriggerProps };
/* oxlint-enable import/no-named-export */
