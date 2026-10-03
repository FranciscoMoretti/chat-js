import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getEveConversationProject } from "@/lib/db/eve-queries";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ProjectChatPageRoute: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const ProjectChatPageRoute = async ({
  params,
}: {
  params: Promise<{
    projectId: string;
    chatId: string;
  }>;
}) => {
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
  const project = await getEveConversationProject(session.user.id, chatId);
  if (project?.id !== projectId) {
    notFound();
  }
  redirect(`/chat/${chatId}`);
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default ProjectChatPageRoute;
/* oxlint-enable import/no-default-export */
