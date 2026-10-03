import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import React, { Suspense } from "react";
import { z } from "zod";

import { EveCreationRecovery } from "@/components/eve/eve-creation-recovery";
import { EveProjectHome } from "@/components/eve/eve-project-home";
import { auth } from "@/lib/auth";
import { listEveConversations } from "@/lib/db/eve-queries";
import { getProjectById } from "@/lib/db/queries";
/* oxlint-disable max-statements, react-perf/jsx-no-new-object-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- ProjectContent: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; ; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including project). */

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
/* oxlint-enable max-statements, react-perf/jsx-no-new-object-as-prop, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ProjectPageRoute: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: Parameters<typeof ProjectContent>[0]). */

const ProjectPageRoute = (
  props: Parameters<typeof ProjectContent>[0]
): React.JSX.Element => (
  <Suspense
    fallback={
      <div className="text-muted-foreground p-4 text-sm">Loading project…</div>
    }
  >
    <ProjectContent {...props} />
  </Suspense>
);
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react/jsx-no-literals, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default ProjectPageRoute;
/* oxlint-enable import/no-default-export */
