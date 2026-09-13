import { notFound, redirect } from "next/navigation";

import { isEveEnabled } from "@/lib/eve/availability";

const AgentPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    conversation?: string;
  }>;
}) => {
  if (!isEveEnabled()) {
    notFound();
  }
  const { conversation } = await searchParams;
  redirect(conversation ? `/chat/${encodeURIComponent(conversation)}` : "/");
};

export default AgentPage;
