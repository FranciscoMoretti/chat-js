"use client";

import type { CSSProperties, ElementType, JSX as ReactJSX } from "react";
import React, { memo, useCallback, useMemo } from "react";
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

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = DEFAULT_SHIMMER_DURATION_SECONDS,
  spread = DEFAULT_SHIMMER_SPREAD_PIXELS,
}: TextShimmerProps): ReactJSX.Element => {
  const [, animate] = useAnimate<HTMLElement>();
  const attachAnimation = useCallback(
    (element: HTMLElement | null): (() => void) | undefined => {
      if (element === null) {
        return undefined;
      }
      const animation = animate(
        element,
        { backgroundPosition: ["100% center", "0% center"] },
        {
          duration,
          ease: "linear",
          repeat: Number.POSITIVE_INFINITY,
        }
      );
      return (): void => {
        animation.stop();
      };
    },
    [animate, duration]
  );
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
      ref={attachAnimation}
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
        "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))]",
        className
      )}
      style={style}
    >
      {children}
    </Component>
  );
};
const Shimmer = memo(ShimmerComponent);
export { Shimmer };
export type { TextShimmerProps };
