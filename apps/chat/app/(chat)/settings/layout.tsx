import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React, { Suspense } from "react";
import type { JSX as ReactJSX } from "react";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { auth } from "@/lib/auth";

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

const SettingsLayoutContent = async ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): Promise<ReactJSX.Element> => {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
};

const SettingsLayout = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => (
  <Suspense fallback={<SettingsLayoutShell />}>
    <SettingsLayoutContent>{children}</SettingsLayoutContent>
  </Suspense>
);
export default SettingsLayout;
