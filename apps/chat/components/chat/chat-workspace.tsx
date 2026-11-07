"use client";
import type { ComponentProps } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export const ChatWorkspace = (
  props: ComponentProps<typeof SidebarProvider>
) => <SidebarProvider data-slot="chat-workspace" {...props} />;

export const ChatWorkspaceContent = ({
  className,
  ...props
}: ComponentProps<typeof SidebarInset>) => (
  <SidebarInset
    data-slot="chat-workspace-content"
    className={cn("[--header-height:calc(var(--spacing)*13)]", className)}
    {...props}
  />
);
