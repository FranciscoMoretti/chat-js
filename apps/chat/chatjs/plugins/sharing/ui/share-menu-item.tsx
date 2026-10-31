"use client";
import React from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";
import { useSession } from "@/providers/session-provider";
import { ShareMenuSurface } from "./share-menu-surface";

export const ShareMenuItem = ({
  onShare,
  children,
}: {
  readonly children?: ReadonlyReactNode;
  readonly onShare: () => void;
}): React.JSX.Element => {
  const { data: session } = useSession();
  return (
    <ShareMenuSurface authenticated={Boolean(session?.user)} onShare={onShare}>
      {children}
    </ShareMenuSurface>
  );
};
