"use client";

import { hasCustomContent } from "@/components/custom-content";

import type { ComponentProps, JSX as ReactJSX } from "react";
import React, { createContext, useContext, useMemo } from "react";
import { getUsage } from "tokenlens";
import { Button } from "@/components/ui/button";
import {
  HoverCardContent,
} from "@/components/ui/hover-card";
import { ContextHover, ContextHoverTrigger } from "./context-hover";
import { Progress } from "@/components/ui/progress";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { StoredLanguageModelUsage } from "@/lib/ai/usage-token-details";
import { cn } from "@/lib/utils";
import { getUsageTokenDetails } from "@/lib/ai/usage-token-details";

const PERCENT_MAX = 100;
const NO_KNOWN_TOKENS = 0;
const NO_KNOWN_COST = 0;

type ModelId = string;

interface ContextSchema {
  usedTokens: number;
  maxTokens: number;
  usage?: StoredLanguageModelUsage;
  modelId?: ModelId;
}

const ContextContext = createContext<ContextSchema | null>(null);

const useContextValue = (): ContextSchema => {
  const context = useContext(ContextContext);

  if (!context) {
    throw new Error("Context components must be used within Context");
  }

  return context;
};

type ContextProps = ComponentProps<typeof ContextHover> & ContextSchema;

const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  ...props
}: ContextProps): ReactJSX.Element => {
  const contextValue = useMemo(
    () => ({ maxTokens, modelId, usage, usedTokens }),
    [maxTokens, modelId, usage, usedTokens]
  );

  return (
    <ContextContext.Provider value={contextValue}>
      <ContextHover {...props} />
    </ContextContext.Provider>
  );
};

type ContextTriggerProps = ComponentProps<typeof Button>;

const ContextTrigger = ({
  children,
  ...props
}: ContextTriggerProps): React.JSX.Element => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const renderedPercent = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);

  return (
    <ContextHoverTrigger button={
        <Button type="button" variant="outline" size="sm" {...props}>
          {children ?? <span>{renderedPercent} context</span>}
        </Button>
    } />
  );
};

type ContextContentProps = (Omit<ComponentProps<typeof HoverCardContent>, "className"> & { className?: string });

const ContextContent = ({
  className,
  ...props
}: ContextContentProps): React.JSX.Element => (
  <HoverCardContent
    className={cn("min-w-60 divide-y overflow-hidden p-0", className)}
    {...props}
  />
);

type ContextContentHeaderProps = ComponentProps<"div">;

const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps): React.JSX.Element => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const displayPct = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);
  const used = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(usedTokens);
  const total = new Intl.NumberFormat("en-US", {
    notation: "compact",
  }).format(maxTokens);

  return (
    <div className={cn("w-full space-y-2 p-3", className)} {...props}>
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p>{displayPct}</p>
            <p className="text-muted-foreground font-mono">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress aria-label="Context used" value={usedPercent * PERCENT_MAX} />
          </div>
        </>
      )}
    </div>
  );
};

type ContextContentBodyProps = ComponentProps<"div">;

const ContextContentBody = ({
  children,
  className,
  ...props
}: ContextContentBodyProps): React.JSX.Element => (
  <div className={cn("w-full p-3", className)} {...props}>
    {children}
  </div>
);

type ContextContentFooterProps = ComponentProps<"div">;

const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps): React.JSX.Element => {
  const { modelId, usage } = useContextValue();
  const costUSD =
    typeof modelId === "string" && modelId !== ""
      ? getUsage({
          modelId,
          usage: {
            input: usage?.inputTokens ?? NO_KNOWN_TOKENS,
            output: usage?.outputTokens ?? NO_KNOWN_TOKENS,
          },
        }).costUSD?.totalUSD
      : undefined;
  const totalCost = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(costUSD ?? NO_KNOWN_COST);

  return (
    <div
      className={cn(
        "bg-secondary flex w-full items-center justify-between gap-3 p-3 text-xs",
        className
      )}
      {...props}
    >
      {children ?? (
        <>
          <span className="text-muted-foreground">Total cost</span>
          <span>{totalCost}</span>
        </>
      )}
    </div>
  );
};

type ContextInputUsageProps = ComponentProps<"div">;
type ContextUsageResult =
  | Exclude<React.ReactNode, false | undefined>
  | React.JSX.Element
  | null;

const TokensWithCost = ({
  tokens,
  costText,
}: {
  readonly tokens?: number;
  readonly costText?: string;
}): React.JSX.Element => (
  <span>
    {tokens === undefined
      ? "—"
      : new Intl.NumberFormat("en-US", {
          notation: "compact",
        }).format(tokens)}
    {typeof costText === "string" && costText !== "" ? (
      <span className="text-muted-foreground ml-2">• {costText}</span>
    ) : null}
  </span>
);

const ContextInputUsage = ({
  className,
  children,
  ...props
}: ContextInputUsageProps): ContextUsageResult => {
  const { usage, modelId } = useContextValue();
  const inputTokens = usage?.inputTokens ?? NO_KNOWN_TOKENS;

  if (hasCustomContent(children)) {
    return children;
  }

  if (!inputTokens) {
    return null;
  }

  const inputCost =
    typeof modelId === "string" && modelId !== ""
      ? getUsage({
          modelId,
          usage: { input: inputTokens, output: NO_KNOWN_TOKENS },
        }).costUSD?.totalUSD
      : undefined;
  const inputCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(inputCost ?? NO_KNOWN_COST);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Input</span>
      <TokensWithCost costText={inputCostText} tokens={inputTokens} />
    </div>
  );
};

type ContextOutputUsageProps = ComponentProps<"div">;

const ContextOutputUsage = ({
  className,
  children,
  ...props
}: ContextOutputUsageProps): ContextUsageResult => {
  const { usage, modelId } = useContextValue();
  const outputTokens = usage?.outputTokens ?? NO_KNOWN_TOKENS;

  if (hasCustomContent(children)) {
    return children;
  }

  if (!outputTokens) {
    return null;
  }

  const outputCost =
    typeof modelId === "string" && modelId !== ""
      ? getUsage({
          modelId,
          usage: { input: NO_KNOWN_TOKENS, output: outputTokens },
        }).costUSD?.totalUSD
      : undefined;
  const outputCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(outputCost ?? NO_KNOWN_COST);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Output</span>
      <TokensWithCost costText={outputCostText} tokens={outputTokens} />
    </div>
  );
};

type ContextReasoningUsageProps = ComponentProps<"div">;

const ContextReasoningUsage = ({
  className,
  children,
  ...props
}: ContextReasoningUsageProps): ContextUsageResult => {
  const { usage, modelId } = useContextValue();
  const { reasoningTokens } = getUsageTokenDetails(usage);

  if (hasCustomContent(children)) {
    return children;
  }

  if (!reasoningTokens) {
    return null;
  }

  const reasoningCost =
    typeof modelId === "string" && modelId !== ""
      ? getUsage({
          modelId,
          usage: { reasoningTokens },
        }).costUSD?.totalUSD
      : undefined;
  const reasoningCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(reasoningCost ?? NO_KNOWN_COST);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Reasoning</span>
      <TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
    </div>
  );
};

type ContextCacheUsageProps = ComponentProps<"div">;

const ContextCacheUsage = ({
  className,
  children,
  ...props
}: ContextCacheUsageProps): ContextUsageResult => {
  const { usage, modelId } = useContextValue();
  const cacheTokens = getUsageTokenDetails(usage).cachedInputTokens;

  if (hasCustomContent(children)) {
    return children;
  }

  if (!cacheTokens) {
    return null;
  }

  const cacheCost =
    typeof modelId === "string" && modelId !== ""
      ? getUsage({
          modelId,
          usage: {
            cacheReads: cacheTokens,
            input: NO_KNOWN_TOKENS,
            output: NO_KNOWN_TOKENS,
          },
        }).costUSD?.totalUSD
      : undefined;
  const cacheCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cacheCost ?? NO_KNOWN_COST);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      {...props}
    >
      <span className="text-muted-foreground">Cache</span>
      <TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
    </div>
  );
};

export {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
};
export type {
  ContextCacheUsageProps,
  ContextContentBodyProps,
  ContextContentFooterProps,
  ContextContentHeaderProps,
  ContextContentProps,
  ContextInputUsageProps,
  ContextOutputUsageProps,
  ContextProps,
  ContextReasoningUsageProps,
  ContextTriggerProps,
};
