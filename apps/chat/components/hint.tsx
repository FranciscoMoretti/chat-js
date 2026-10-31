"use client";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** A tooltip and its focusable trigger, without an additional DOM wrapper. */
export const Hint = ({
  trigger,
  children,
  contentProps,
}: {
  readonly trigger: ReactElement;
  readonly children: ReactNode;
  readonly contentProps?: Pick<
    ComponentProps<typeof TooltipContent>,
    "align" | "side" | "className"
  >;
}) => (
  <Tooltip>
    <TooltipTrigger render={trigger} />
    <TooltipContent {...contentProps}>{children}</TooltipContent>
  </Tooltip>
);
