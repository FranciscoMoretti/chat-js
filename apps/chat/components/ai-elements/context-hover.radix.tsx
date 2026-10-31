"use client";

import React from "react";
import type { ComponentProps, ReactElement } from "react";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";

export const ContextHover = (
  props: ComponentProps<typeof HoverCard>
): React.JSX.Element => <HoverCard openDelay={0} closeDelay={0} {...props} />;

export const ContextHoverTrigger = ({
  button,
}: {
  readonly button: ReactElement;
}): React.JSX.Element => <HoverCardTrigger asChild>{button}</HoverCardTrigger>;
