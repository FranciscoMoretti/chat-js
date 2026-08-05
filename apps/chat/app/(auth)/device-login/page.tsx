import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { DeviceLoginPage } from "@/components/device-login-page";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { toSearchParamRecord } from "@/lib/electron-auth";

export const metadata: Metadata = {
  title: "Device Login",
  description: "Sign in for the desktop app",
};

function DeviceLoginFallback() {
  return (
    <div className="container mx-auto flex h-dvh w-screen items-center justify-center px-4">
      <AuthCardSkeleton
        contentClassName="w-full max-w-md"
        description="Connecting your desktop app"
        title="Device login"
        variant="device"
      />
    </div>
  );
}

export default function DeviceLoginRoute({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!config.desktopApp.enabled) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<DeviceLoginFallback />}>
      <DeviceLoginContent searchParams={searchParams} />
    </Suspense>
  );
}

async function DeviceLoginContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = toSearchParamRecord(resolvedSearchParams);
  const isCompletedView = query.done === "1";
  const queryString = new URLSearchParams(query).toString();
  const currentHref = queryString
    ? `/device-login?${queryString}`
    : "/device-login";
  const session = await auth.api.getSession({ headers: await headers() });

  if (!(session?.user || isCompletedView)) {
    redirect(`/login?returnTo=${encodeURIComponent(currentHref)}`);
  }

  return (
    <Suspense fallback={<DeviceLoginFallback />}>
      <DeviceLoginPage />
    </Suspense>
  );
}
