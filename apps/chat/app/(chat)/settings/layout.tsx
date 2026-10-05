import { headers } from "next/headers";
import { redirect } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { auth } from "@/lib/auth";
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
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve SettingsLayoutContent's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SettingsLayoutContent: ; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, }: { children: React.ReactNode; }). */

const SettingsLayoutContent = async ({
  children,
}: {
  children: React.ReactNode;
}): Promise<ReactJSX.Element> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this layout module and create-component-tree selects its default component SettingsLayout.
export default SettingsLayout;
