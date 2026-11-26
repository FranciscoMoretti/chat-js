"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import Script from "next/script"
import { cn } from "cn"

import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button"
import { useThemeToggle } from "@/vendor/shadcn-create/hooks/use-theme-toggle"

export const DARK_MODE_FORWARD_TYPE = "dark-mode-forward"

export function ModeSwitcher({
  variant = "ghost",
  showLabel = false,
  keyboardShortcut = false,
  className,
}: {
  showLabel?: boolean
  keyboardShortcut?: boolean
  variant?: React.ComponentProps<typeof Button>["variant"]
  className?: React.ComponentProps<typeof Button>["className"]
}) {
  const { toggleTheme } = useThemeToggle(keyboardShortcut)

  return (
    <Button
      variant={variant}
      size={showLabel ? "sm" : "icon"}
      className={cn("group/toggle extend-touch-target", className)}
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      <Moon aria-hidden="true" className="size-4 dark:hidden" />
      <Sun aria-hidden="true" className="hidden size-4 dark:block" />
      {showLabel && (
        <>
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </>
      )}
    </Button>
  )
}

export function DarkModeScript() {
  return (
    <Script
      id="dark-mode-listener"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{
        __html: `
            (function() {
              // Forward D key
              document.addEventListener('keydown', function(e) {
                if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
                  if (
                    (e.target instanceof HTMLElement && e.target.isContentEditable) ||
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    e.target instanceof HTMLSelectElement
                  ) {
                    return;
                  }
                  e.preventDefault();
                  if (window.parent && window.parent !== window) {
                    window.parent.postMessage({
                      type: '${DARK_MODE_FORWARD_TYPE}',
                      key: e.key
                    }, window.location.origin);
                  }
                }
              });

            })();
          `,
      }}
    />
  )
}
