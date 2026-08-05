import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DeviceLoginPage } from "@/components/device-login-page";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Device login</CardTitle>
          <CardDescription>Connecting your desktop app</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Skeleton className="mx-auto h-10 w-10 rounded-full" />
            <Skeleton className="mx-auto h-4 w-56" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
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
