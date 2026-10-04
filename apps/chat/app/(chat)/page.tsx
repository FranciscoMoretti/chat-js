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
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component HomePage.
export default HomePage;
