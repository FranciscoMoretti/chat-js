// ChatJS source: sharing. Ownership: chatjs/plugins/sharing/chatjs.json.
import React, { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveSharedPage } from "@/chatjs/plugins/sharing/ui/shared-page";

const SharedChatPageContent = async ({
  params,
}: {
  readonly params: Readonly<Promise<{ readonly id: string }>>;
}): Promise<React.JSX.Element> => {
  const { id } = await params;
  return <EveSharedPage id={id} />;
};

const SharedChatPageRoute = ({
  params,
}: {
  readonly params: Readonly<Promise<{ readonly id: string }>>;
}): React.JSX.Element => (
  <Suspense fallback={<ChatLoadingShell />}>
    <SharedChatPageContent params={params} />
  </Suspense>
);
export default SharedChatPageRoute;
