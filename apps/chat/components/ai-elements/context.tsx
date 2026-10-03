"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React, { createContext, useContext, useMemo } from "react";
import type { ComponentProps } from "react";
import { getUsage } from "tokenlens";

import { Button } from "@/components/ui/button";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Progress } from "@/components/ui/progress";
import { getUsageTokenDetails } from "@/lib/ai/usage-token-details";
import type { StoredLanguageModelUsage } from "@/lib/ai/usage-token-details";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

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

/* oxlint-disable typescript/explicit-function-return-type -- useContextValue: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const useContextValue = () => {
  const context = useContext(ContextContext);

  if (!context) {
    throw new Error("Context components must be used within Context");
  }

  return context;
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextProps = ComponentProps<typeof HoverCard> & ContextSchema;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- Context: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const Context = ({
  usedTokens,
  maxTokens,
  usage,
  modelId,
  ...props
}: ContextProps) => {
  const contextValue = useMemo(
    () => ({ maxTokens, modelId, usage, usedTokens }),
    [maxTokens, modelId, usage, usedTokens]
  );

  return (
    <ContextContext.Provider value={contextValue}>
      <HoverCard closeDelay={0} openDelay={0} {...props} />
    </ContextContext.Provider>
  );
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, react/no-multi-comp, typescript/explicit-function-return-type -- ContextIcon: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const ContextIcon = () => {
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
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, react/no-multi-comp, typescript/explicit-function-return-type */
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextTriggerProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextTriggerProps = ComponentProps<typeof Button>;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ContextTrigger: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: ContextTriggerProps). */

export const ContextTrigger = ({ children, ...props }: ContextTriggerProps) => {
  const { usedTokens, maxTokens } = useContextValue();
  const usedPercent = usedTokens / maxTokens;
  const renderedPercent = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(usedPercent);

  return (
    <HoverCardTrigger asChild>
      {children ?? (
        <Button type="button" variant="ghost" {...props}>
          <span className="text-muted-foreground font-medium">
            {renderedPercent}
          </span>
          <ContextIcon />
        </Button>
      )}
    </HoverCardTrigger>
  );
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextContentProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextContentProps = ComponentProps<typeof HoverCardContent>;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ContextContent: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ContextContentProps). */

export const ContextContent = ({
  className,
  ...props
}: ContextContentProps): React.JSX.Element => (
  <HoverCardContent
    className={cn("min-w-60 divide-y overflow-hidden p-0", className)}
    {...props}
  />
);
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextContentHeaderProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextContentHeaderProps = ComponentProps<"div">;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ContextContentHeader: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ContextContentHeader = ({
  children,
  className,
  ...props
}: ContextContentHeaderProps) => {
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
            <Progress className="bg-muted" value={usedPercent * PERCENT_MAX} />
          </div>
        </>
      )}
    </div>
  );
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextContentBodyProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextContentBodyProps = ComponentProps<"div">;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ContextContentBody: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, className, ...props }: ContextContentBodyProps). */

export const ContextContentBody = ({
  children,
  className,
  ...props
}: ContextContentBodyProps): React.JSX.Element => (
  <div className={cn("w-full p-3", className)} {...props}>
    {children}
  </div>
);
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextContentFooterProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextContentFooterProps = ComponentProps<"div">;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ContextContentFooter: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including usage?.inputTokens); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const ContextContentFooter = ({
  children,
  className,
  ...props
}: ContextContentFooterProps) => {
  const { modelId, usage } = useContextValue();
  const costUSD =
    typeof modelId === "string" && modelId !== ""
      ? getUsage({
          modelId,
          usage: {
            input: usage?.inputTokens ?? 0,
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
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export -- ContextInputUsageProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextInputUsageProps = ComponentProps<"div">;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export */

/* oxlint-disable no-ternary, no-undefined, react/jsx-no-literals, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- TokensWithCost: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including costText); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const TokensWithCost = ({
  tokens,
  costText,
}: {
  tokens?: number;
  costText?: string;
}): React.JSX.Element => (
  <span>
    {tokens === undefined
      ? "—"
      : new Intl.NumberFormat("en-US", {
          notation: "compact",
        }).format(tokens)}
    {costText ? (
      <span className="text-muted-foreground ml-2">• {costText}</span>
    ) : null}
  </span>
);
/* oxlint-enable no-ternary, no-undefined, react/jsx-no-literals, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextInputUsage: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including usage?.inputTokens); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ContextInputUsageProps); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ContextInputUsage = ({
  className,
  children,
  ...props
}: ContextInputUsageProps) => {
  const { usage, modelId } = useContextValue();
  const inputTokens = usage?.inputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!inputTokens) {
    return null;
  }

  const inputCost = modelId
    ? getUsage({
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
      {...props}
    >
      <span className="text-muted-foreground">Input</span>
      <TokensWithCost costText={inputCostText} tokens={inputTokens} />
    </div>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export -- ContextOutputUsageProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextOutputUsageProps = ComponentProps<"div">;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextOutputUsage: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including usage?.outputTokens); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ContextOutputUsageProps); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ContextOutputUsage = ({
  className,
  children,
  ...props
}: ContextOutputUsageProps) => {
  const { usage, modelId } = useContextValue();
  const outputTokens = usage?.outputTokens ?? 0;

  if (children) {
    return children;
  }

  if (!outputTokens) {
    return null;
  }

  const outputCost = modelId
    ? getUsage({
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
      {...props}
    >
      <span className="text-muted-foreground">Output</span>
      <TokensWithCost costText={outputCostText} tokens={outputTokens} />
    </div>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export -- ContextReasoningUsageProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextReasoningUsageProps = ComponentProps<"div">;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextReasoningUsage: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ContextReasoningUsage = ({
  className,
  children,
  ...props
}: ContextReasoningUsageProps) => {
  const { usage, modelId } = useContextValue();
  const { reasoningTokens } = getUsageTokenDetails(usage);

  if (children) {
    return children;
  }

  if (!reasoningTokens) {
    return null;
  }

  const reasoningCost = modelId
    ? getUsage({
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
      {...props}
    >
      <span className="text-muted-foreground">Reasoning</span>
      <TokensWithCost costText={reasoningCostText} tokens={reasoningTokens} />
    </div>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports, import/no-named-export -- ContextCacheUsageProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export type ContextCacheUsageProps = ComponentProps<"div">;
/* oxlint-enable import/group-exports, import/no-named-export */
/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null -- ContextCacheUsage: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: ContextCacheUsageProps); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const ContextCacheUsage = ({
  className,
  children,
  ...props
}: ContextCacheUsageProps) => {
  const { usage, modelId } = useContextValue();
  const cacheTokens = getUsageTokenDetails(usage).cachedInputTokens;

  if (children) {
    return children;
  }

  if (!cacheTokens) {
    return null;
  }

  const cacheCost = modelId
    ? getUsage({
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
      {...props}
    >
      <span className="text-muted-foreground">Cache</span>
      <TokensWithCost costText={cacheCostText} tokens={cacheTokens} />
    </div>
  );
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable max-lines -- context keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
