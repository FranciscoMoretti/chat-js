import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveChatPage } from "@/components/eve/eve-chat-page";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- ConversationPage: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { params, }: { params: Promise<{ id: string; }>; }). */

const ConversationPage = async ({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}): Promise<ReactJSX.Element> => {
  const resolvedResult1 = await params;
  return <EveChatPage conversationId={resolvedResult1.id} />;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
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
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component ChatPageRoute.
export default ChatPageRoute;
