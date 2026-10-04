import { redirect } from "next/navigation";
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- AgentPage: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const AgentPage = async ({
  searchParams,
}: {
  searchParams: Promise<{
    conversation?: string;
  }>;
}) => {
  const { conversation } = await searchParams;
  redirect(
    typeof conversation === "string" && conversation !== ""
      ? `/chat/${encodeURIComponent(conversation)}`
      : "/"
  );
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this page module and create-component-tree selects its default component AgentPage.
export default AgentPage;
