import { Suspense } from "react";
import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
import { isEveEnabled } from "@/lib/eve/availability";

export default function HomePage() {
  if (!isEveEnabled()) {
    return null;
  }
  return (
    <Suspense fallback={<ChatLoadingShell />}>
      <EveChatPage />
    </Suspense>
  );
}
