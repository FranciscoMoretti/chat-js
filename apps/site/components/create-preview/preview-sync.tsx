"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { useTheme } from "next-themes";
import { useInstallation } from "./installation-provider";

export const ChatPreviewSync = ({
  iframeRef,
}: Readonly<{ iframeRef: RefObject<HTMLIFrameElement | null> }>) => {
  const { installation } = useInstallation();
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    const iframe = iframeRef.current;
    const send = () =>
      iframe?.contentWindow?.postMessage(
        {
          type: "chatjs:create-installation",
          installation,
          mode: resolvedTheme === "dark" ? "dark" : "light",
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
  }, [iframeRef, installation, resolvedTheme]);
  return null;
};
