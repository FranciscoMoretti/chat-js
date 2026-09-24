"use client";

import { useAnimate } from "motion/react";
import { memo, useEffect } from "react";
import type { CSSProperties, ElementType } from "react";

import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
};

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

export const Shimmer = memo(ShimmerComponent);
