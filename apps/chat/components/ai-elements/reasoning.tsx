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

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

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
  useCallback(
    (newOpen: boolean) => {
      setIsOpen(newOpen);
    },
    [setIsOpen]
  );

const AUTO_CLOSE_DELAY = 1000;
const MS_IN_S = 1000;
const NO_RECORDED_REASONING_DURATION = 0;
const THINKING_SHIMMER_DURATION_SECONDS = 1;

const useReasoningDuration = (
  isStreaming: boolean,
  setDuration: (duration: number) => void
): void => {
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

  useEffect((): (() => void) | undefined => {
    if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
      const timer = setTimeout(() => {
        setIsOpen(false);
        setHasAutoClosed(true);
      }, AUTO_CLOSE_DELAY);

      return (): void => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);
};

const ReasoningComponent = ({
  className,
  isStreaming = false,
  open,
  defaultOpen = true,
  onOpenChange,
  duration: durationProp,
  children,
  ...props
}: ReasoningProps) => {
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
        className={cn("not-prose mb-4", className)}
        onOpenChange={handleOpenChange}
        open={isOpen}
        {...props}
      >
        {children}
      </Collapsible>
    </ReasoningContext.Provider>
  );
};
const Reasoning = memo(ReasoningComponent);
type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

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

const ReasoningTriggerComponent = ({
  className,
  children,
  ...props
}: ReasoningTriggerProps) => {
  const { isStreaming, isOpen, duration } = useReasoning();

  return (
    <CollapsibleTrigger
      className={cn(
        "text-muted-foreground hover:text-foreground flex w-full items-center gap-2 text-sm transition-colors",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <BrainIcon className="size-4" />
          {getThinkingMessage(isStreaming, duration)}
          <ChevronDownIcon
            className={cn(
              "size-4 transition-transform",
              isOpen ? "rotate-180" : "rotate-0"
            )}
          />
        </>
      )}
    </CollapsibleTrigger>
  );
};
const ReasoningTrigger = memo(ReasoningTriggerComponent);

type ReasoningContentProps = ComponentProps<typeof CollapsibleContent> & {
  children: string;
};

const ReasoningContentComponent = ({
  className,
  children,
  ...props
}: ReasoningContentProps): React.JSX.Element => (
  <CollapsibleContent
    className={cn(
      "mt-4 text-sm",
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground data-[state=closed]:animate-out data-[state=open]:animate-in outline-none",
      className
    )}
    {...props}
  >
    <Response className="grid gap-2">{children}</Response>
  </CollapsibleContent>
);
const ReasoningContent = memo(ReasoningContentComponent);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
export { Reasoning, ReasoningContent, ReasoningTrigger };
export type { ReasoningContentProps, ReasoningProps, ReasoningTriggerProps };
