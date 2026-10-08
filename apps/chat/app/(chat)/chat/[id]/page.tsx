import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ConversationPage's awaited sequencing and rejected-Promise behavior. */

const ConversationPage = async ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly id: string;
    }>
  >;
}): Promise<React.JSX.Element> => {
  const resolvedResult1 = await params;
  return <EveChatPage conversationId={resolvedResult1.id} />;
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp -- ChatPageRoute: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; }>; }). */

const ChatPageRoute = ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly id: string;
    }>
  >;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <ConversationPage params={params} />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component ChatPageRoute.
export default ChatPageRoute;
