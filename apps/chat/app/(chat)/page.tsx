import { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";

const HomePage = () => (
  <Suspense fallback={<ChatLoadingShell />}>
    <EveChatPage />
  </Suspense>
);

export default HomePage;
