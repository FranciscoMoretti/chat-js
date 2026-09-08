"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ChatProviders } from "./chat-providers";
import { ChatRouteHost } from "./chat-route-host";

export function ChatRuntimeBoundary({
  children,
  eveEnabled,
}: {
  children: ReactNode;
  eveEnabled: boolean;
}) {
  const pathname = usePathname();
  if (
    eveEnabled &&
    (pathname === "/" ||
      pathname === "/agent" ||
      pathname?.startsWith("/chat/") ||
      pathname?.startsWith("/project/"))
  ) {
    return children;
  }
  return (
    <ChatProviders>
      <ChatRouteHost>{children}</ChatRouteHost>
    </ChatProviders>
  );
}
