"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { DrawerClose } from "@/components/ui/drawer";

export const DrawerCloseButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <DrawerClose asChild>
    <Button {...props}>{children}</Button>
  </DrawerClose>
);
