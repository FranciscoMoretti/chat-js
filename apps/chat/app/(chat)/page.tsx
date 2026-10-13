import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";

const HomePage = (): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <EveChatPage />
  </Suspense>
);
export default HomePage;
