import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
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
  return (
    <section className="space-y-4 p-4">
      <header className="flex items-center gap-3">
        <SidebarTrigger />
        <h1 className="text-xl">{project.name}</h1>
      </header>
      <p>
        Project conversations will be available when Eve project support is
        ready.
      </p>
      <Link className="underline" href="/">
        Start a conversation outside this project
      </Link>
    </section>
  );
}
