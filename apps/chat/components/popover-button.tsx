"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";

export const PopoverButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <PopoverTrigger render={<Button {...props} />}>{children}</PopoverTrigger>
);
