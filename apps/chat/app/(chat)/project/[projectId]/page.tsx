import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { EveProjectHome } from "@/components/eve/eve-project-home";
import { auth } from "@/lib/auth";
import { listEveConversations } from "@/lib/db/eve-queries";
import { getProjectById } from "@/lib/db/queries";
import { isEveEnabled } from "@/lib/eve/availability";

export default async function ProjectPageRoute({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  if (!isEveEnabled()) {
    return null;
  }
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) {
    notFound();
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    notFound();
  }
  const initialPage = await listEveConversations(session.user.id, {
    search: "",
    projectId,
  });
  return (
    <EveProjectHome
      initialPage={initialPage}
      initialProject={project}
      ownerId={session.user.id}
    />
  );
}
