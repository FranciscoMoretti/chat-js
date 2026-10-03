import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
/* oxlint-disable oxc/no-async-await, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- ConversationPage: oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { params, }: { params: Promise<{ id: string; }>; }). */

const ConversationPage = async ({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) => {
  const resolvedResult1 = await params;
  return <EveChatPage conversationId={resolvedResult1.id} />;
};
/* oxlint-enable oxc/no-async-await, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ChatPageRoute: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { params, }: { params: Promise<{ id: string; }>; }). */

const ChatPageRoute = ({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <ConversationPage params={params} />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default ChatPageRoute;
/* oxlint-enable import/no-default-export */
