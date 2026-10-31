"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export const MenuButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <DropdownMenuTrigger render={<Button {...props} />}>
    {children}
  </DropdownMenuTrigger>
);
