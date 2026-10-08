"use client";

import { useAnimate } from "motion/react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { CSSProperties, ElementType, JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
import React, { memo, useEffect } from "react";

import { cn } from "@/lib/utils";

interface TextShimmerProps {
  readonly children: string;
  readonly as?: ElementType;
  readonly className?: string;
  readonly duration?: number;
  readonly spread?: number;
}

/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop -- ShimmerComponent: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result */

const ShimmerComponent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- This reader retains the native React component constructor and callable signatures; the faithful readonly control preserves them and the native rule still flags that graph. */
  {
    children,
    as: Component = "p",
    className,
    duration = 2,
    spread = 2,
  }: TextShimmerProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
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
    return (): void => animation.stop();
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- Oxlint 1.82.0 reports Component as extra because only JSX reads it. Motion keeps scope stable when `as` replaces scope.current; this dependency stops the old animation and starts one on the new node.
  }, [animate, scope, duration, Component]);
  const dynamicSpread = children.length * spread;

  return (
    <Component
      ref={scope}
      // oxlint-disable-next-line react/forbid-component-props -- The polymorphic Component defaults to p and accepts the className needed by the shimmer animation.
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]",
        className
      )}
      // oxlint-disable-next-line react/forbid-component-props -- The polymorphic Component defaults to p and accepts the style needed by the shimmer animation.
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
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop */

const Shimmer = memo(ShimmerComponent);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Shimmer); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Shimmer };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (TextShimmerProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { TextShimmerProps };
/* oxlint-enable import/no-named-export */
