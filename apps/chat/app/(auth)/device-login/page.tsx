import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { DeviceLoginPage } from "@/components/device-login-page";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import { toSearchParamRecord } from "@/lib/electron-auth";

const metadata: Metadata = {
  description: "Sign in for the desktop app",
  title: "Device Login",
};

const DeviceLoginFallback = (): React.JSX.Element => (
  <div className="container mx-auto flex h-dvh w-screen items-center justify-center px-4">
    <AuthCardSkeleton
      cardClassName="w-full max-w-md"
      description="Connecting your desktop app"
      title="Device login"
      variant="device"
    />
  </div>
);

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve DeviceLoginContent's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp -- react-perf/jsx-no-jsx-as-prop (#555): Server Suspense constructs the fallback for the request; retaining its render position preserves the streaming shell.
react/no-multi-comp (#552): DeviceLoginContent keeps related render components together; extraction changes component, state, and layout boundaries. */

const DeviceLoginContent = async ({
  searchParams,
}: {
  readonly searchParams: Readonly<
    Promise<Readonly<Record<string, string | readonly string[] | undefined>>>
  >;
}): Promise<React.JSX.Element> => {
  const resolvedSearchParams = await searchParams;
  const query = toSearchParamRecord(resolvedSearchParams);
  const isCompletedView = query.done === "1";
  const queryString = new URLSearchParams(query).toString();
  // oxlint-disable-next-line no-ternary -- Keep currentHref as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const currentHref = queryString
    ? `/device-login?${queryString}`
    : "/device-login";
  const session = await auth.api.getSession({ headers: await headers() });

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (!(session?.user || isCompletedView)) {
    redirect(`/login?returnTo=${encodeURIComponent(currentHref)}`);
  }

  return (
    <Suspense fallback={<DeviceLoginFallback />}>
      <DeviceLoginPage />
    </Suspense>
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp -- react-perf/jsx-no-jsx-as-prop (#555): The route retains the existing outer Suspense fallback and desktop feature gate.
react/no-multi-comp (#552): The shell and request-time content form the nested Suspense route architecture. */

const DeviceLoginRoute = ({
  searchParams,
}: {
  readonly searchParams: Readonly<
    Promise<Readonly<Record<string, string | readonly string[] | undefined>>>
  >;
}): React.JSX.Element => {
  if (!config.desktopApp.enabled) {
    redirect("/login");
  }

  return (
    <Suspense fallback={<DeviceLoginFallback />}>
      <DeviceLoginContent searchParams={searchParams} />
    </Suspense>
  );
};
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (metadata); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp */

/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default DeviceLoginRoute;
/* oxlint-enable import/no-default-export */
