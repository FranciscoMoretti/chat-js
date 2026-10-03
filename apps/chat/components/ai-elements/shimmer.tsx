"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { useAnimate } from "motion/react";
import React, { memo, useEffect } from "react";
import type { CSSProperties, ElementType } from "react";

import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-disable import/exports-last, import/no-named-export -- TextShimmerProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}
/* oxlint-enable import/exports-last, import/no-named-export */

/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- ShimmerComponent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const [scope, animate] = useAnimate<HTMLElement>();
  useEffect(() => {
    const animation = animate(
      scope.current,
      { backgroundPosition: ["100% center", "0% center"] },
      {
        duration,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }
    );
    return () => animation.stop();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Changing `as` replaces the animated DOM node even when duration stays the same.
  }, [animate, scope, duration, Component]);
  const dynamicSpread = children.length * spread;

  return (
    <Component
      ref={scope}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]",
        className
      )}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
          backgroundPosition: "100% center",
        } as CSSProperties
      }
    >
      {children}
    </Component>
  );
};
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-named-export -- Shimmer: import/no-named-export: existing callers import this public component, type, or hook by name. */

export const Shimmer = memo(ShimmerComponent);
/* oxlint-enable import/no-named-export */
