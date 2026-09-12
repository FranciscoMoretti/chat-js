"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { InternalLink } from "@/components/internal-link";
import { useGetCredits } from "@/hooks/chat-sync-hooks";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

import { Button } from "../ui/button";

const VARIANT_CONFIG: Record<
  "credits" | "model" | "image",
  {
    dismissible: boolean;
    getMessage: ({
      remaining,
      isAtLimit,
    }: {
      remaining: number;
      isAtLimit: boolean;
    }) => React.ReactNode;
    getClasses: ({ isAtLimit }: { isAtLimit: boolean }) => string;
  }
> = {
  credits: {
    dismissible: true,
    getClasses: ({ isAtLimit }) =>
      isAtLimit
        ? "bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200"
        : "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200",
    getMessage: ({ remaining, isAtLimit }) =>
      isAtLimit ? (
        <span>
          You&apos;ve reached your credit limit.{" "}
          <InternalLink
            className="font-medium text-red-700 underline hover:no-underline dark:text-red-300"
            href="/login"
          >
            Sign in to reset your limits
          </InternalLink>
        </span>
      ) : (
        <span>
          You only have{" "}
          <strong>
            {remaining} credit{remaining === 1 ? "" : "s"}
          </strong>{" "}
          left.{" "}
          <InternalLink
            className="font-medium text-amber-700 underline hover:no-underline dark:text-amber-300"
            href="/login"
          >
            Sign in to reset your limits
          </InternalLink>
        </span>
      ),
  },
  image: {
    dismissible: false,
    getClasses: () =>
      "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200",
    getMessage: () => <span>Image models are not supported here yet.</span>,
  },
  model: {
    dismissible: false,
    getClasses: () =>
      "bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200",
    getMessage: () => (
      <span>
        This model isn&apos;t available for anonymous users.{" "}
        <InternalLink
          className="font-medium text-amber-700 underline hover:no-underline dark:text-amber-300"
          href="/login"
        >
          Log in to use this model
        </InternalLink>
      </span>
    ),
  },
};

export const LimitDisplay = ({
  className,
  forceVariant,
}: {
  className?: string;
  forceVariant?: "credits" | "model" | "image";
}) => {
  const { credits, isLoadingCredits } = useGetCredits();
  const { data: session } = useSession();
  const isAuthenticated = !!session?.user;
  const [dismissed, setDismissed] = useState(false);

  // Don't show for authenticated users
  if (isAuthenticated) {
    return null;
  }

  const variant = forceVariant ?? "credits";
  const config = VARIANT_CONFIG[variant];

  // Credits variant relies on credits API state
  if (variant === "credits" && isLoadingCredits) {
    return null;
  }

  // Don't show if dismissed
  if (config.dismissible && dismissed) {
    return null;
  }

  const remaining = credits ?? 0;

  // Only show when approaching or at limit (credits variant)
  const isAtLimit = remaining <= 0;

  return (
    <AnimatePresence>
      <motion.div
        animate={{ height: "auto", opacity: 1 }}
        className={cn("w-full", className)}
        exit={{ height: 0, opacity: 0 }}
        initial={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm",
            config.getClasses({ isAtLimit })
          )}
        >
          <div className="flex-1">
            {config.getMessage({
              isAtLimit,
              remaining,
            })}
          </div>
          {config.dismissible ? (
            <Button
              className="h-6 w-6 p-0 hover:bg-transparent"
              onClick={() => setDismissed(true)}
              size="sm"
              variant="ghost"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
