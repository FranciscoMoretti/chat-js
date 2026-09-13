"use client";

import { ArrowRight } from "lucide-react";

import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

interface LoginPromptProps {
  className?: string;
  description: string;
  title: string;
}

export function LoginPrompt({
  title,
  description,
  className,
}: LoginPromptProps) {
  return (
    <div className={cn("space-y-3 p-4", className)}>
      <div className="flex items-center gap-2">
        <ArrowRight className="text-muted-foreground h-4 w-4" />
        <h4 className="text-sm font-medium">{title}</h4>
      </div>
      <p className="text-muted-foreground ml-6 text-sm">{description}</p>
      <InternalLink
        className="ml-6 block text-sm font-medium text-blue-500 hover:underline"
        href="/login"
      >
        Sign in
      </InternalLink>
    </div>
  );
}
