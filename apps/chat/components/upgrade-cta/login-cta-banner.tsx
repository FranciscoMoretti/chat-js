"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { LogIn, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import React, { useState } from "react";

import { InternalLink } from "@/components/internal-link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

interface LoginCtaBannerProps {
  className?: string;
  compact?: boolean;
  dismissible?: boolean;
  message: string;
  variant?: "default" | "amber" | "red";
}
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- LoginCtaBanner: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including compact ? "px-3 py-2" : "px-4 py-3"); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
    amber:
      "bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800",
    default:
      "bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800",
    red: "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800",
  };

  const textStyles = {
    amber: "text-amber-800 dark:text-amber-200",
    default: "text-blue-800 dark:text-blue-200",
    red: "text-red-800 dark:text-red-200",
  };

  const linkStyles = {
    amber:
      "text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100",
    default:
      "text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100",
    red: "text-red-700 dark:text-red-300 hover:text-red-900 dark:hover:text-red-100",
  };

  return (
    <AnimatePresence>
      <motion.div
        animate={{ height: "auto", opacity: 1 }}
        className="w-full"
        exit={{ height: 0, opacity: 0 }}
        initial={{ height: 0, opacity: 0 }}
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
