"use client";
import type { ReactNode } from "react";
import { DirectionProvider } from "@/components/ui/direction";

export const UiDirection = ({
  direction,
  children,
}: {
  readonly direction: "ltr" | "rtl";
  readonly children: ReactNode;
}) => <DirectionProvider direction={direction}>{children}</DirectionProvider>;
