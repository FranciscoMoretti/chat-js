"use client"

import * as React from "react"
import { useTheme } from "next-themes"


export function useThemeToggle(keyboardShortcut = true) {
  const { setTheme, resolvedTheme } = useTheme()
  const toggleTheme = React.useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }, [resolvedTheme, setTheme])

  // Listen for the D key to toggle theme.
  React.useEffect(() => {
    if (!keyboardShortcut) return
    const down = (e: KeyboardEvent) => {
      if (
        (e.key === "d" || e.key === "D") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.defaultPrevented
      ) {
        if (
          (e.target instanceof HTMLElement && e.target.isContentEditable) ||
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement ||
          e.target instanceof HTMLSelectElement
        ) {
          return
        }

        e.preventDefault()
        toggleTheme()
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [keyboardShortcut, toggleTheme])

  return { toggleTheme }
}
