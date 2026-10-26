"use client"

import * as React from "react"

import type { DesignSystemSearchParams } from "@/vendor/shadcn-create/lib/search-params"

type ParentToIframeMessage = {
  type: "design-system-params"
  data: DesignSystemSearchParams
}

export const isInIframe = () => {
  if (typeof window === "undefined") {
    return false
  }
  return window.self !== window.top
}

export function useIframeMessageListener<
  Message extends ParentToIframeMessage,
  MessageType extends Message["type"],
>(
  messageType: MessageType,
  onMessage: (data: Extract<Message, { type: MessageType }>["data"]) => void
) {
  const onMessageRef = React.useRef(onMessage)

  React.useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  React.useEffect(() => {
    if (!isInIframe()) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.origin === window.location.origin && event.source === window.parent && event.data && typeof event.data === "object" && event.data.type === messageType && event.data.data && typeof event.data.data === "object") {
        onMessageRef.current(event.data.data)
      }
    }

    window.addEventListener("message", handleMessage)
    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [messageType])
}

export function sendToIframe<
  Message extends ParentToIframeMessage,
  MessageType extends Message["type"],
>(
  iframe: HTMLIFrameElement | null,
  messageType: MessageType,
  data: Extract<Message, { type: MessageType }>["data"]
) {
  if (!iframe?.contentWindow) {
    return
  }

  iframe.contentWindow.postMessage(
    {
      type: messageType,
      data,
    },
    window.location.origin
  )
}
