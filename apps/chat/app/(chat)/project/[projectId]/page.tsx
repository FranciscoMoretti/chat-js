import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { EveCreationRecovery } from "@/components/eve/eve-creation-recovery";
import { EveProjectHome } from "@/components/eve/eve-project-home";
import { auth } from "@/lib/auth";
import { listEveConversations } from "@/lib/db/eve-queries";
import { getProjectById } from "@/lib/db/queries";

const ProjectContent = async ({
  params,
}: {
  params: Promise<{
    projectId: string;
  }>;
}) => {
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
    return (
      <div className="p-4">
        <h1 className="text-xl font-semibold">Project unavailable</h1>
        <EveCreationRecovery
          firstMessage=""
          ownerId={session.user.id}
          scope={{ projectId }}
        />
      </div>
    );
  }
  const initialPage = await listEveConversations(session.user.id, {
    projectId,
    search: "",
  });
  return (
    <EveProjectHome
      initialPage={initialPage}
      initialProject={project}
      ownerId={session.user.id}
    />
  );
};

const ProjectPageRoute = (props: Parameters<typeof ProjectContent>[0]) => (
  <Suspense
    fallback={
      <div className="text-muted-foreground p-4 text-sm">Loading project…</div>
    }
  >
    <ProjectContent {...props} />
  </Suspense>
);

export default ProjectPageRoute;
