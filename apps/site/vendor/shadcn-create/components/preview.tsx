"use client"

import * as React from "react"

import { CMD_K_FORWARD_TYPE } from "@/vendor/shadcn-create/components/action-menu"
import { ChatPreviewSync } from "@/components/create-preview/preview-sync"
import { PreviewRecovery } from "@/components/create-preview/preview-recovery"
import {
  REDO_FORWARD_TYPE,
  UNDO_FORWARD_TYPE,
} from "@/vendor/shadcn-create/components/history-buttons"
import { DARK_MODE_FORWARD_TYPE } from "@/vendor/shadcn-create/components/mode-switcher"
import { usePreviewOverrideValue } from "@/vendor/shadcn-create/components/preview-override"
import { PreviewSwitcher } from "@/vendor/shadcn-create/components/preview-switcher"
import { RANDOMIZE_FORWARD_TYPE } from "@/vendor/shadcn-create/components/random-button"
import { sendToIframe } from "@/vendor/shadcn-create/hooks/use-iframe-sync"
import { OPEN_PRESET_FORWARD_TYPE } from "@/vendor/shadcn-create/hooks/use-open-preset"
import { RESET_FORWARD_TYPE } from "@/vendor/shadcn-create/hooks/use-reset"
import {
  serializeDesignSystemSearchParams,
  useDesignSystemSearchParams,
} from "@/vendor/shadcn-create/lib/search-params"

// Hoisted — avoids recreating on every message event. (js-hoist-regexp)
const MAC_REGEX = /Mac|iPhone|iPad|iPod/

function isSameParams(
  a: ReturnType<typeof useDesignSystemSearchParams>[0] | null,
  b: ReturnType<typeof useDesignSystemSearchParams>[0]
) {
  if (!a) {
    return false
  }

  return Object.keys(b).every(
    (key) => a[key as keyof typeof b] === b[key as keyof typeof b]
  )
}

export function Preview({ guestEnabled, guest, onGuestChange }: {
  readonly guestEnabled: boolean
  readonly guest: boolean
  readonly onGuestChange: (guest: boolean) => void
}) {
  const [params, setParams] = useDesignSystemSearchParams()
  const override = usePreviewOverrideValue()
  const iframeRef = React.useRef<HTMLIFrameElement>(null)
  const lastSentParamsRef = React.useRef<typeof params | null>(null)

  // Hover previews overlay the committed params without touching the URL —
  // clearing the override re-sends the committed params, reverting the preview.
  const mergedParams = React.useMemo(
    // The library choice belongs to installation. The shared application preview
    // uses Base UI for both outputs, without remounting its local runtime.
    () => ({ ...params, ...override, base: "base" as const }),
    [params, override]
  )

  const mergedParamsRef = React.useRef(mergedParams)
  React.useEffect(() => {
    mergedParamsRef.current = mergedParams
  }, [mergedParams])

  React.useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }

    const sendParams = () => {
      sendToIframe(iframe, "design-system-params", mergedParams)
      lastSentParamsRef.current = mergedParams
    }

    // Skip content-identical re-sends (e.g. an override matching the committed
    // params) — each message triggers a full param sync in the iframe.
    if (
      iframe.contentWindow &&
      !isSameParams(lastSentParamsRef.current, mergedParams)
    ) {
      sendParams()
    }

    iframe.addEventListener("load", sendParams)
    return () => {
      iframe.removeEventListener("load", sendParams)
    }
  }, [mergedParams])

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const iframeWindow = iframeRef.current?.contentWindow
      if (
        !iframeWindow ||
        event.origin !== window.location.origin ||
        event.source !== iframeWindow ||
        !event.data ||
        typeof event.data !== "object"
      ) {
        return
      }

      const type = event.data.type
      if (type === "chatjs:create-preview-ready") {
        // A document load can precede React hydration. Replay the latest host
        // state once the preview has installed its message listeners.
        sendToIframe(iframeRef.current, "design-system-params", mergedParamsRef.current)
        lastSentParamsRef.current = mergedParamsRef.current
      } else if (type === "chatjs:create-select-scene") {
        const item = event.data.item
        if (item === "preview" || item === "preview-02" || item === "preview-tools") {
          void setParams({ item })
        }
      } else if (type === CMD_K_FORWARD_TYPE) {
        const isMac = MAC_REGEX.test(navigator.userAgent)
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: event.data.key || "k",
            metaKey: isMac,
            ctrlKey: !isMac,
            bubbles: true,
            cancelable: true,
          })
        )
      } else if (type === RANDOMIZE_FORWARD_TYPE) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: event.data.key || "r",
            bubbles: true,
            cancelable: true,
          })
        )
      } else if (type === OPEN_PRESET_FORWARD_TYPE) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: event.data.key || "o",
            bubbles: true,
            cancelable: true,
          })
        )
      } else if (type === UNDO_FORWARD_TYPE) {
        const isMac = MAC_REGEX.test(navigator.userAgent)
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "z",
            metaKey: isMac,
            ctrlKey: !isMac,
            bubbles: true,
            cancelable: true,
          })
        )
      } else if (type === REDO_FORWARD_TYPE) {
        const isMac = MAC_REGEX.test(navigator.userAgent)
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "z",
            shiftKey: true,
            metaKey: isMac,
            ctrlKey: !isMac,
            bubbles: true,
            cancelable: true,
          })
        )
      } else if (type === RESET_FORWARD_TYPE) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: "R",
            shiftKey: true,
            bubbles: true,
            cancelable: true,
          })
        )
      } else if (type === DARK_MODE_FORWARD_TYPE) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            key: event.data.key || "d",
            bubbles: true,
            cancelable: true,
          })
        )
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [setParams])

  const iframeSrc = React.useMemo(() => {
    // The iframe src needs to include the serialized design system params
    // for the initial load, but not be reactive to them as it would cause
    // full-iframe reloads on every param change (flashes & loss of state).
    // Further updates of the search params will be sent to the iframe
    // via a postMessage channel, for it to sync its own history onto the host's.
    return serializeDesignSystemSearchParams(
      `/create/preview`,
      { ...params, base: "base" }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-2xl ring ring-foreground/10 md:ring-muted dark:ring-foreground/10">
      <PreviewSwitcher guestEnabled={guestEnabled} guest={guest} onGuestChange={onGuestChange} />
      <div data-testid="preview-viewport" className="relative z-0 mx-auto min-h-0 w-full flex-1 overflow-auto overscroll-contain bg-muted dark:bg-muted/30">
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className={`relative z-10 mx-auto block h-full min-h-[40rem] bg-background transition-[width] md:min-h-0 ${params.size === 100 ? "min-w-[64rem] md:min-w-0" : ""}`}
          style={{ width: params.size === 100 ? "100%" : `${params.size}px` }}
          title="Preview"
        />
        {/* Keep the floating scene controls clear of the composer at the end of the canvas. */}
        <div aria-hidden="true" className="h-14 md:hidden" />
        <PreviewRecovery iframeRef={iframeRef} />
      </div>
      <ChatPreviewSync iframeRef={iframeRef} guest={guest} />
    </div>
  )
}
