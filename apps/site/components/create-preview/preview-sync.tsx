"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { useInstallation } from "./installation-provider";

export const ChatPreviewSync = ({
  iframeRef,
  guest,
}: Readonly<{
  iframeRef: RefObject<HTMLIFrameElement | null>;
  guest: boolean;
}>) => {
  const { resolution, scenario } = useInstallation();
  const installation = resolution?.selection ?? null;
  useEffect(() => {
    const iframe = iframeRef.current;
    const send = () =>
      iframe?.contentWindow?.postMessage(
        {
          type: "chatjs:create-installation",
          installation,
          guest,
          scenario,
        },
        window.location.origin
      );
    const ready = (event: MessageEvent<unknown>) => {
      if (
        event.origin === window.location.origin &&
        event.source === iframe?.contentWindow
      ) {
        send();
      }
    };
    send();
    iframe?.addEventListener("load", send);
    window.addEventListener("message", ready);
    return () => {
      iframe?.removeEventListener("load", send);
      window.removeEventListener("message", ready);
    };
  }, [iframeRef, installation, guest, scenario]);
  return null;
};
