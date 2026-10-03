import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- HomePage: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render. */

const HomePage = (): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <EveChatPage />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default HomePage;
/* oxlint-enable import/no-default-export */
