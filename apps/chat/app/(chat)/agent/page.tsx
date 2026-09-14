import { redirect } from "next/navigation";

const AgentPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    conversation?: string;
  }>;
}) => {
  const { conversation } = await searchParams;
  redirect(conversation ? `/chat/${encodeURIComponent(conversation)}` : "/");
};

export default AgentPage;
