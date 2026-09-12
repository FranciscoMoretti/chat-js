"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export const SettingsPage = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex min-h-0 flex-1 flex-col gap-6 overflow-hidden",
      className
    )}
  >
    {children}
  </div>
);

export const SettingsPageHeader = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={cn("shrink-0", className)}>{children}</div>;

export const SettingsPageContent = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", className)}
  >
    {children}
  </div>
);

export const SettingsPageScrollArea = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <ScrollArea className={className}>{children}</ScrollArea>;
