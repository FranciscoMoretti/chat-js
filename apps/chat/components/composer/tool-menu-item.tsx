"use client";
import React from "react";
import type { ReactNode } from "react";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export const ToolMenuItem = ({
  children,
  disabled,
  onActivate,
  checked,
}: {
  readonly children: ReactNode;
  readonly disabled?: boolean;
  readonly onActivate: () => void;
  readonly checked: boolean;
}): React.JSX.Element => (
  <DropdownMenuCheckboxItem
    disabled={disabled}
    checked={checked}
    closeOnClick={true}
    onClick={onActivate}
  >
    {children}
  </DropdownMenuCheckboxItem>
);
