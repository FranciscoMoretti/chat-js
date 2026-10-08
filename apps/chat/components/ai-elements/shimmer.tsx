"use client";

import type { CSSProperties, ElementType, JSX as ReactJSX } from "react";
import React, { memo, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useAnimate } from "motion/react";

const DEFAULT_SHIMMER_DURATION_SECONDS = 2;
const DEFAULT_SHIMMER_SPREAD_PIXELS = 2;

interface TextShimmerProps {
  readonly children: string;
  readonly as?: ElementType;
  readonly className?: string;
  readonly duration?: number;
  readonly spread?: number;
}

const ShimmerComponent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- This reader retains the native React component constructor and callable signatures; the faithful readonly control preserves them and the native rule still flags that graph. */
  {
    children,
    as: Component = "p",
    className,
    duration = DEFAULT_SHIMMER_DURATION_SECONDS,
    spread = DEFAULT_SHIMMER_SPREAD_PIXELS,
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
  const style = useMemo(
    () =>
      ({
        "--spread": `${dynamicSpread}px`,
        backgroundImage:
          "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        backgroundPosition: "100% center",
      }) as CSSProperties,
    [dynamicSpread]
  );

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
      style={style}
    >
      {children}
    </Component>
  );
};
const Shimmer = memo(ShimmerComponent);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Shimmer); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Shimmer };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (TextShimmerProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { TextShimmerProps };
/* oxlint-enable import/no-named-export */
