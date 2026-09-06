"use client";
import type { ReactNode } from "react";
import { useArtifactSelector } from "@/hooks/use-artifact";
import { ArtifactStreamObserver } from "./artifact-stream-observer";
import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "./chat-layout";
import { SecondaryChatPanel } from "./secondary-chat-panel";

export function Workspace({ children }: { children: ReactNode }) {
  const visible = useArtifactSelector((state) => state.isVisible);
  return (
    <ChatLayout isSecondaryPanelVisible={visible}>
      <ArtifactStreamObserver />
      <ChatLayoutMain>{children}</ChatLayoutMain>
      <ChatLayoutHandle />
      <ChatLayoutSecondary>
        <SecondaryChatPanel
          className="flex h-full min-w-0 flex-1 flex-col"
          isReadonly={false}
        />
      </ChatLayoutSecondary>
    </ChatLayout>
  );
}
