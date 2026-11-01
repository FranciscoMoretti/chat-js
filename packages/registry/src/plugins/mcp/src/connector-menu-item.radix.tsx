"use client";
import React from "react";
import type { ReactNode } from "react";
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export const ConnectorMenuItem = ({
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
    onSelect={(event: Event) => {
      event.preventDefault();
      onActivate();
    }}
  >
    {children}
  </DropdownMenuCheckboxItem>
);
