import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getChatById } from "@/lib/db/queries";
import { isEveEnabled } from "@/lib/eve/availability";

export default async function ProjectChatPageRoute({
  params,
}: {
  params: Promise<{ projectId: string; chatId: string }>;
}) {
  if (!isEveEnabled()) {
    return null;
  }
  const { projectId, chatId } = await params;
  if (
    !(
      z.uuid().safeParse(projectId).success &&
      z.uuid().safeParse(chatId).success
    )
  ) {
    notFound();
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const chat = await getChatById({ id: chatId });
  if (
    !chat ||
    chat.userId !== session.user.id ||
    chat.projectId !== projectId
  ) {
    notFound();
  }
  redirect(`/chat/${chatId}`);
}
