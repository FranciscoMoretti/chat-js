import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveSharedPage } from "@/components/eve/eve-shared-page";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve SharedChatPageContent's awaited sequencing and rejected-Promise behavior. */

const SharedChatPageContent = async ({
  params,
}: {
  readonly params: Readonly<Promise<{ readonly id: string }>>;
}): Promise<React.JSX.Element> => {
  const { id } = await params;
  return <EveSharedPage id={id} />;
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp -- SharedChatPageRoute: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; }). */

const SharedChatPageRoute = ({
  params,
}: {
  readonly params: Readonly<Promise<{ readonly id: string }>>;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <SharedChatPageContent params={params} />
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component SharedChatPageRoute.
export default SharedChatPageRoute;
