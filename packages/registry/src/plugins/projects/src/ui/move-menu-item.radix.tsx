"use client";
import React from "react";
import type { ReactNode } from "react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export const MoveMenuItem = ({
  children,
  disabled,
  onActivate,
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
}): React.JSX.Element => (
  <DropdownMenuItem
    disabled={disabled}
    onSelect={(event: Event) => {
      event.preventDefault();
      onActivate();
    }}
  >
    {children}
  </DropdownMenuItem>
);
