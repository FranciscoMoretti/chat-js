import { headers } from "next/headers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { notFound, redirect } from "next/navigation";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */
import { getEveConversationProject } from "@/lib/db/eve-queries";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve ProjectChatPageRoute's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- ProjectChatPageRoute: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships */

const ProjectChatPageRoute = async ({
  params,
}: {
  readonly params: Readonly<
    Promise<{
      readonly projectId: string;
      readonly chatId: string;
    }>
  >;
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!session?.user) {
    redirect("/login");
  }
  const project = await getEveConversationProject(session.user.id, chatId);
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from project; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (project?.id !== projectId) {
    notFound();
  }
  redirect(`/chat/${chatId}`);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component ProjectChatPageRoute.
export default ProjectChatPageRoute;
