import type { JSX as ReactJSX } from "react";
import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveSharedPage } from "@/components/eve/eve-shared-page";
/* oxlint-disable typescript/prefer-readonly-parameter-types -- SharedChatPageContent: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { params, }: { params: Promise<{ id: string }>; }). */

const SharedChatPageContent = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactJSX.Element> => {
  const { id } = await params;
  return <EveSharedPage id={id} />;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SharedChatPageRoute: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { params, }: { params: Promise<{ id: string }>; }). */

const SharedChatPageRoute = ({
  params,
}: {
  params: Promise<{ id: string }>;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <SharedChatPageContent params={params} />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component SharedChatPageRoute.
export default SharedChatPageRoute;
