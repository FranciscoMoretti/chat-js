"use client";

import { useEffect, useState } from "react";
import type { RefObject } from "react";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";

// A document load can succeed even when the preview fails to hydrate. Wait for
// the application's ready message, and offer recovery for either failure.
export const PreviewRecovery = ({
  iframeRef,
}: Readonly<{ iframeRef: RefObject<HTMLIFrameElement | null> }>) => {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading"
  );

  useEffect(() => {
    const timeout =
      status === "loading"
        ? window.setTimeout(() => {
            setStatus("failed");
          }, 15_000)
        : undefined;
    const ready = (event: MessageEvent<unknown>) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframeRef.current?.contentWindow &&
        event.data !== null &&
        typeof event.data === "object" &&
        "type" in event.data &&
        event.data.type === "chatjs:create-preview-ready"
      ) {
        window.clearTimeout(timeout);
        setStatus("ready");
      }
    };
    window.addEventListener("message", ready);
    // Browser history can restore an already-hydrated iframe before this
    // listener mounts. Request another acknowledgment instead of waiting for a
    // one-time ready message that may already have been delivered.
    if (status === "loading") {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "chatjs:create-request-preview-ready" },
        window.location.origin
      );
    }
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("message", ready);
    };
  }, [status, iframeRef]);

  if (status === "ready") {
    return null;
  }

  return (
    <div className="bg-background absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center">
      <output className="text-muted-foreground text-sm">
        {status === "loading" ? "Loading preview…" : "Preview could not load."}
      </output>
      {status === "failed" && (
        <Button
          variant="outline"
          onClick={() => {
            setStatus("loading");
            const iframe = iframeRef.current;
            if (iframe) {
              iframe.setAttribute("src", iframe.src);
            }
          }}
        >
          Retry preview
        </Button>
      )}
    </div>
  );
};
