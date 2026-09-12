"use client";

import { LogIn, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { InternalLink } from "@/components/internal-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LoginCtaBannerProps {
  className?: string;
  compact?: boolean;
  dismissible?: boolean;
  message: string;
  variant?: "default" | "amber" | "red";
}

export const LoginCtaBanner = ({
  message,
  className,
  variant = "default",
  dismissible = false,
  compact = false,
}: LoginCtaBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  const variantStyles = {
    default:
      "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800",
    amber:
      "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800",
    red: "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800",
  };

  const textStyles = {
    default: "text-blue-800 dark:text-blue-200",
    amber: "text-amber-800 dark:text-amber-200",
    red: "text-red-800 dark:text-red-200",
  };

  const linkStyles = {
    default:
      "text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100",
    amber:
      "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100",
    red: "text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100",
  };

  return (
    <AnimatePresence>
      <motion.div
        animate={{ opacity: 1, height: "auto" }}
        className="w-full"
        exit={{ opacity: 0, height: 0 }}
        initial={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg",
            compact ? "px-3 py-2" : "px-4 py-3",
            variantStyles[variant],
            className
          )}
        >
          <div className="flex flex-1 items-center gap-2">
            {!compact && (
              <LogIn className={cn("h-4 w-4 shrink-0", textStyles[variant])} />
            )}
            <span className={cn("text-sm", textStyles[variant])}>
              {message}{" "}
              <InternalLink
                className={cn(
                  "font-medium underline hover:no-underline",
                  linkStyles[variant]
                )}
                href="/login"
              >
                Sign in
              </InternalLink>
            </span>
          </div>
          {dismissible && (
            <Button
              className="h-6 w-6 p-0 opacity-70 hover:bg-transparent hover:opacity-100"
              onClick={() => setDismissed(true)}
              size="sm"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
