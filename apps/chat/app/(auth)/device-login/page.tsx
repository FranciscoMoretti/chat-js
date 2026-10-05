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
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types --
 * react-perf/jsx-no-jsx-as-prop (#555): DeviceLoginContent creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): DeviceLoginContent keeps related render components together; extraction changes component, state, and layout boundaries.
 * typescript/explicit-function-return-type (#560): Keep DeviceLoginContent's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): DeviceLoginContent accepts { searchParams, }: { searchParams: Promise<Record<string, string | string[] | undefin; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const DeviceLoginContent = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const resolvedSearchParams = await searchParams;
  const query = toSearchParamRecord(resolvedSearchParams);
  const isCompletedView = query.done === "1";
  const queryString = new URLSearchParams(query).toString();
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
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types --
 * react-perf/jsx-no-jsx-as-prop (#555): DeviceLoginRoute creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): DeviceLoginRoute keeps related render components together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): DeviceLoginRoute accepts { searchParams, }: { searchParams: Promise<Record<string, string | string[] | undefin; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const DeviceLoginRoute = ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
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
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default DeviceLoginRoute;
/* oxlint-enable import/no-default-export */
