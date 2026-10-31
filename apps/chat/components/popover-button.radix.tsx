"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { PopoverTrigger } from "@/components/ui/popover";

export const PopoverButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <PopoverTrigger asChild>
    <Button {...props}>{children}</Button>
  </PopoverTrigger>
);
