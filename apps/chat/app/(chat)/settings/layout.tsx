import { headers } from "next/headers";
import { redirect } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { auth } from "@/lib/auth";

/* oxlint-disable react/jsx-max-depth -- SettingsLayoutShell: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

const SettingsLayoutShell = ({
  children,
}: {
  readonly children?: ReadonlyReactNode;
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
/* oxlint-enable react/jsx-max-depth */
/* oxlint-disable react/no-multi-comp -- SettingsLayoutContent: ; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; }). */

const SettingsLayoutContent = async ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): Promise<ReactJSX.Element> => {
  const session = await auth.api.getSession({ headers: await headers() });

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp -- SettingsLayout: react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const SettingsLayout = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => (
  <Suspense fallback={<SettingsLayoutShell />}>
    <SettingsLayoutContent>{children}</SettingsLayoutContent>
  </Suspense>
);
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp */
// oxlint-disable-next-line import/no-default-export -- Next.js 16.3 discovers this layout module and create-component-tree selects its default component SettingsLayout.
export default SettingsLayout;
