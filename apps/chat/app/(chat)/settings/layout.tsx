import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SettingsHeader } from "@/components/settings/settings-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { auth } from "@/lib/auth";

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<SettingsLayoutShell>{children}</SettingsLayoutShell>}>
      <SettingsLayoutContent>{children}</SettingsLayoutContent>
    </Suspense>
  );
}

function SettingsLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh max-h-dvh w-full max-w-4xl flex-1 flex-col px-2 py-2 md:px-4">
      <SettingsHeader />
      <div className="mb-4 md:hidden">
        <Suspense fallback={null}>
          <SettingsNav orientation="horizontal" />
        </Suspense>
      </div>
      <div className="flex min-h-0 flex-1 gap-4">
        <div className="hidden md:block">
          <Suspense fallback={null}>
            <SettingsNav orientation="vertical" />
          </Suspense>
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col px-4">
          {children}
        </div>
      </div>
    </div>
  );
}

async function SettingsLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsLayoutShell>{children}</SettingsLayoutShell>;
}
