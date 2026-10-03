/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React, { Suspense } from "react";

import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */
/* oxlint-disable react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- SettingsLayoutShell: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children }: { children?: React.ReactNode }). */

const SettingsLayoutShell = ({
  children,
}: {
  children?: React.ReactNode;
}): React.JSX.Element => (
  <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-4xl flex-1 flex-col px-2 py-2 md:px-4">
    <SettingsHeader />
    <div className="mb-4 md:hidden">
      <SettingsNav orientation="horizontal" />
    </div>
    <div className="flex min-h-0 flex-1 gap-4">
      <div className="hidden md:block">
        <SettingsNav orientation="vertical" />
      </div>
      <div className="flex min-h-0 w-full flex-1 flex-col px-4">{children}</div>
    </div>
  </div>
);
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
/* oxlint-disable oxc/no-async-await, oxc/no-optional-chaining, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- SettingsLayoutContent: oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including session?.user); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, }: { children: React.ReactNode; }). */

const SettingsLayoutContent = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
};
/* oxlint-enable oxc/no-async-await, oxc/no-optional-chaining, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsLayout: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children }: { children: React.ReactNode }). */

const SettingsLayout = ({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element => (
  <Suspense fallback={<SettingsLayoutShell />}>
    <SettingsLayoutContent>{children}</SettingsLayoutContent>
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/no-default-export -- layout route: import/no-default-export: Next.js loads this route entry point through its required default export. */

export default SettingsLayout;
/* oxlint-enable import/no-default-export */
