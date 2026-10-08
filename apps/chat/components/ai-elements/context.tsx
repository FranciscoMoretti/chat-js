"use client";

import type { ComponentProps, JSX as ReactJSX } from "react";
import React, { createContext, useContext, useMemo } from "react";
import { getUsage } from "tokenlens";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
/* oxlint-enable sort-imports */
import { Progress } from "@/components/ui/progress";
import { getUsageTokenDetails } from "@/lib/ai/usage-token-details";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { StoredLanguageModelUsage } from "@/lib/ai/usage-token-details";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";

const PERCENT_MAX = 100;
const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

type ModelId = string;

interface ContextSchema {
  usedTokens: number;
  maxTokens: number;
  usage?: StoredLanguageModelUsage;
  modelId?: ModelId;
}
/* oxlint-disable unicorn/no-null -- ContextContext: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ContextContext = createContext<ContextSchema | null>(null);
/* oxlint-enable unicorn/no-null */

const useContextValue = (): ContextSchema => {
  const context = useContext(ContextContext);

  if (!context) {
    throw new Error("Context components must be used within Context");
  }

  return context;
};

type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema;

const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes usedTokens, maxTokens, usage, modelId from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ReadonlyNativeSurface<ContextProps>): ReactJSX.Element => {
  const contextValue = useMemo(
    () => ({ maxTokens, modelId, usage, usedTokens }),
    [maxTokens, modelId, usage, usedTokens]
  );

  return (
    <ContextContext.Provider value={contextValue}>
      <HoverCard
        closeDelay={0}
        openDelay={0}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Context's HoverCard prop contract, preserving caller options, children and callbacks.
        {...props}
      />
    </ContextContext.Provider>
  );
};

/* oxlint-disable no-magic-numbers, react/no-multi-comp -- ContextIcon: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract. */

const ContextIcon = (): React.JSX.Element => {
  const { usedTokens, maxTokens } = useContextValue();
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const usedPercent = usedTokens / maxTokens;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-label="Model context usage"
      height="20"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    </svg>
  );
};
/* oxlint-enable no-magic-numbers, react/no-multi-comp */

type ContextTriggerProps = ComponentProps<typeof Button>;

/* oxlint-disable react/no-multi-comp -- ContextTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ContextTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextTriggerProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const renderedPercent = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);

  return (
    <HoverCardTrigger asChild>
      {children ?? (
        <Button
          type="button"
          variant="ghost"
          // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextTrigger's Button prop contract, preserving caller options, children and callbacks.
          {...props}
        >
          <span className="text-muted-foreground font-medium">
            {renderedPercent}
          </span>
          <ContextIcon />
        </Button>
      )}
    </HoverCardTrigger>
  );
};
/* oxlint-enable react/no-multi-comp */

type ContextContentProps = ComponentProps<typeof HoverCardContent>;

/* oxlint-disable react/no-multi-comp -- ContextContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ContextContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <HoverCardContent
    // oxlint-disable-next-line react/forbid-component-props -- HoverCardContent accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("min-w-60 divide-y overflow-hidden p-0", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextContent's HoverCardContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type ContextContentHeaderProps = ComponentProps<"div">;
/* oxlint-disable react/jsx-no-literals -- ContextContentHeader renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp -- ContextContentHeader: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ContextContentHeader = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextContentHeaderProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
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
    <div
      className={cn("w-full space-y-2 p-3", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextContentHeader's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      {children ?? (
        <>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p>{displayPct}</p>
            <p className="text-muted-foreground font-mono">
              {used} / {total}
            </p>
          </div>
          <div className="space-y-2">
            <Progress
              // oxlint-disable-next-line react/forbid-component-props -- Progress accepts className in its styling contract; preserve this caller's layout and appearance.
              className="bg-muted"
              value={usedPercent * PERCENT_MAX}
            />
          </div>
        </>
      )}
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp */

type ContextContentBodyProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp -- ContextContentBody: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ContextContentBody = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextContentBodyProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn("w-full p-3", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextContentBody's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </div>
);
/* oxlint-enable react/no-multi-comp */

type ContextContentFooterProps = ComponentProps<"div">;
/* oxlint-disable react/jsx-no-literals -- ContextContentFooter renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, no-undefined, react/no-multi-comp -- ContextContentFooter: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const ContextContentFooter = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextContentFooterProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const { modelId, usage } = useContextValue();
  const costUSD =
    // oxlint-disable-next-line no-ternary -- Keep costUSD as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    typeof modelId === "string" && modelId !== ""
      ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading totalUSD from getUsage(...).costUSD; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        getUsage({
          modelId,
          usage: {
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading inputTokens from usage; preserve one receiver evaluation, skipped accesses and the existing 0 fallback. The app guidance prefers optional chaining.
            input: usage?.inputTokens ?? 0,
            // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading outputTokens from usage; preserve one receiver evaluation, skipped accesses and the existing 0 fallback. The app guidance prefers optional chaining.
            output: usage?.outputTokens ?? 0,
          },
        }).costUSD?.totalUSD
      : undefined;
  const totalCost = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(costUSD ?? 0);

  return (
    <div
      className={cn(
        "bg-secondary flex w-full items-center justify-between gap-3 p-3 text-xs",
        className
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextContentFooter's native div attributes, preserving caller events and accessibility props.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, no-undefined, react/no-multi-comp */

type ContextInputUsageProps = ComponentProps<"div">;
/* oxlint-disable react/jsx-no-literals -- TokensWithCost renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-undefined, react/no-multi-comp, typescript/strict-boolean-expressions, unicorn/no-null -- TokensWithCost: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including costText); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const TokensWithCost = ({
  tokens,
  costText,
}: {
  readonly tokens?: number;
  readonly costText?: string;
}): React.JSX.Element => (
  <span>
    {
      // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      tokens === undefined
        ? "—"
        : new Intl.NumberFormat("en-US", {
            notation: "compact",
          }).format(tokens)
    }
    {
      // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      costText ? (
        <span className="text-muted-foreground ml-2">• {costText}</span>
      ) : null
    }
  </span>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ContextInputUsage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable no-undefined, react/no-multi-comp, typescript/strict-boolean-expressions, unicorn/no-null */
/* oxlint-disable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextInputUsage: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ContextInputUsage = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextInputUsageProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
) => {
  const { usage, modelId } = useContextValue();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading inputTokens from usage; preserve one receiver evaluation, skipped accesses and the existing 0 fallback. The app guidance prefers optional chaining.
  const inputTokens = usage?.inputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!inputTokens) {
    return null;
  }

  // oxlint-disable-next-line no-ternary -- Keep inputCost as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const inputCost = modelId
    ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading totalUSD from getUsage(...).costUSD; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      getUsage({
        modelId,
        usage: { input: inputTokens, output: 0 },
      }).costUSD?.totalUSD
    : undefined;
  const inputCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(inputCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextInputUsage's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      <span className="text-muted-foreground">Input</span>
      <TokensWithCost costText={inputCostText} tokens={inputTokens} />
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

type ContextOutputUsageProps = ComponentProps<"div">;
/* oxlint-disable react/jsx-no-literals -- ContextOutputUsage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextOutputUsage: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ContextOutputUsage = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextOutputUsageProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
) => {
  const { usage, modelId } = useContextValue();
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading outputTokens from usage; preserve one receiver evaluation, skipped accesses and the existing 0 fallback. The app guidance prefers optional chaining.
  const outputTokens = usage?.outputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!outputTokens) {
    return null;
  }

  // oxlint-disable-next-line no-ternary -- Keep outputCost as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const outputCost = modelId
    ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading totalUSD from getUsage(...).costUSD; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      getUsage({
        modelId,
        usage: { input: 0, output: outputTokens },
      }).costUSD?.totalUSD
    : undefined;
  const outputCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(outputCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextOutputUsage's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      <span className="text-muted-foreground">Output</span>
      <TokensWithCost costText={outputCostText} tokens={outputTokens} />
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

type ContextReasoningUsageProps = ComponentProps<"div">;
/* oxlint-disable react/jsx-no-literals -- ContextReasoningUsage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextReasoningUsage: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ContextReasoningUsage = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextReasoningUsageProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
) => {
  const { usage, modelId } = useContextValue();
  const { reasoningTokens } = getUsageTokenDetails(usage);

  if (children) {
    return children;
  }

  if (!reasoningTokens) {
    return null;
  }

  // oxlint-disable-next-line no-ternary -- Keep reasoningCost as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const reasoningCost = modelId
    ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading totalUSD from getUsage(...).costUSD; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      getUsage({
        modelId,
        usage: { reasoningTokens },
      }).costUSD?.totalUSD
    : undefined;
  const reasoningCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(reasoningCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextReasoningUsage's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      <span className="text-muted-foreground">Reasoning</span>
      <TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

type ContextCacheUsageProps = ComponentProps<"div">;
/* oxlint-disable react/jsx-no-literals -- ContextCacheUsage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextCacheUsage: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ContextCacheUsage = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ContextCacheUsageProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
) => {
  const { usage, modelId } = useContextValue();
  const cacheTokens = getUsageTokenDetails(usage).cachedInputTokens;

  if (children) {
    return children;
  }

  if (!cacheTokens) {
    return null;
  }

  // oxlint-disable-next-line no-ternary -- Keep cacheCost as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const cacheCost = modelId
    ? // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading totalUSD from getUsage(...).costUSD; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      getUsage({
        modelId,
        usage: { cacheReads: cacheTokens, input: 0, output: 0 },
      }).costUSD?.totalUSD
    : undefined;
  const cacheCostText = new Intl.NumberFormat("en-US", {
    currency: "USD",
    style: "currency",
  }).format(cacheCost ?? 0);

  return (
    <div
      className={cn("flex items-center justify-between text-xs", className)}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward ContextCacheUsage's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      <span className="text-muted-foreground">Cache</span>
      <TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
    </div>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Context, ContextCacheUsage, ContextContent, ContextContentBody, ContextContentFooter, ContextContentHeader, ContextInputUsage, ContextOutputUsage, ContextReasoningUsage, ContextTrigger); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, no-undefined, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- context keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ContextCacheUsageProps, ContextContentBodyProps, ContextContentFooterProps, ContextContentHeaderProps, ContextContentProps, ContextInputUsageProps, ContextOutputUsageProps, ContextProps, ContextReasoningUsageProps, ContextTriggerProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
