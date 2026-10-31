"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { CollapsibleTrigger } from "@/components/ui/collapsible";

export const DisclosureButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <CollapsibleTrigger render={<Button {...props} />}>
    {children}
  </CollapsibleTrigger>
);
