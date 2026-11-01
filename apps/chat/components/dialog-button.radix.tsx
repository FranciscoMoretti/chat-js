"use client";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { DialogTrigger } from "@/components/ui/dialog";

export const DialogButton = ({
  children,
  ...props
}: ComponentProps<typeof Button>) => (
  <DialogTrigger asChild>
    <Button {...props}>{children}</Button>
  </DialogTrigger>
);
