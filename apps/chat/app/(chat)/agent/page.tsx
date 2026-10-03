import { redirect } from "next/navigation";
/* oxlint-disable no-ternary, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- AgentPage: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable no-ternary, oxc/no-async-await, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-default-export -- page route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default AgentPage;
/* oxlint-enable import/no-default-export */
