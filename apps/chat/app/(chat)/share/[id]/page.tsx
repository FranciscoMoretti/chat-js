import { Suspense } from "react";

import { ChatLoadingShell } from "@/components/chat-loading-shell";
import { EveSharedPage } from "@/components/eve/eve-shared-page";

const SharedChatPageContent = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  return <EveSharedPage id={id} />;
};

const SharedChatPageRoute = ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => (
  <Suspense fallback={<ChatLoadingShell />}>
    <SharedChatPageContent params={params} />
  </Suspense>
);

export default SharedChatPageRoute;
