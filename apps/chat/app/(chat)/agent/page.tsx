import { notFound, redirect } from "next/navigation";
import { isEveEnabled } from "@/lib/eve/availability";

export default async function AgentPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  if (!isEveEnabled()) {
    notFound();
  }
  const { conversation } = await searchParams;
  redirect(conversation ? `/chat/${encodeURIComponent(conversation)}` : "/");
}
