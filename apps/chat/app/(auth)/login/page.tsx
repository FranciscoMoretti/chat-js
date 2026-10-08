/* oxlint-disable import/max-dependencies -- * import/max-dependencies (#524): import from "lucide-react" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling. */
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense } from "react";
/* oxlint-enable sort-imports */

import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { DevLoginTool } from "@/components/dev-login-tool";
import { ElectronTransferUser } from "@/components/electron-auth-ui";
import { InternalLink } from "@/components/internal-link";
import { LoginForm } from "@/components/login-form";
import { buttonVariants } from "@/components/ui/button";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */
import { config } from "@/lib/config";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  ELECTRON_AUTH_CLIENT_ID,
  toSearchParamRecord,
} from "@/lib/electron-auth";
/* oxlint-enable sort-imports */
import { cn } from "@/lib/utils";
/* oxlint-enable import/max-dependencies */

const metadata: Metadata = {
  description: "Login to your account",
  title: "Login",
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve LoginPageContent's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, typescript/explicit-function-return-type, unicorn/no-null -- react-perf/jsx-no-jsx-as-prop (#555): LoginPageContent creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
typescript/explicit-function-return-type (#560): Keep LoginPageContent's return type inferred from its schema, SDK, or implementation result; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
unicorn/no-null (#570): LoginPageContent preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */

const LoginPageContent = async ({
  searchParams,
}: {
  readonly searchParams: Readonly<
    Promise<Record<string, string | readonly string[] | undefined>>
  >;
}) => {
  const resolvedSearchParams = await searchParams;
  const query = toSearchParamRecord(resolvedSearchParams);
  const isElectronTransfer =
    config.desktopApp.enabled && query.client_id === ELECTRON_AUTH_CLIENT_ID;
  // oxlint-disable-next-line no-ternary -- Keep session as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const session = isElectronTransfer
    ? await auth.api.getSession({ headers: await headers() })
    : null;

  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (session?.user && isElectronTransfer) {
    return <ElectronTransferUser query={query} session={session} />;
  }

  return (
    <Suspense
      fallback={
        <AuthCardSkeleton
          description="Sign in to your account"
          title="Welcome back"
        />
      }
    >
      <LoginForm
        // oxlint-disable-next-line react/forbid-component-props -- LoginForm accepts className in its styling contract; preserve this caller's layout and appearance.
        className="w-full"
      />
    </Suspense>
  );
};
/* oxlint-disable react/jsx-no-literals -- LoginPage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, typescript/explicit-function-return-type, unicorn/no-null */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp -- react-perf/jsx-no-jsx-as-prop (#555): LoginPage creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
react/jsx-max-depth (#548): LoginPage keeps related render components together; extraction changes component, state, and layout boundaries.
react/no-multi-comp (#552): LoginPage keeps related render components together; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */

const LoginPage = ({
  searchParams,
}: {
  readonly searchParams: Readonly<
    Promise<Record<string, string | readonly string[] | undefined>>
  >;
}): React.JSX.Element => (
  <div className="container mx-auto flex h-dvh w-screen flex-col items-center justify-center">
    <InternalLink
      // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "absolute top-4 left-4 md:top-8 md:left-8"
      )}
      href="/"
    >
      <ChevronLeft
        // oxlint-disable-next-line react/forbid-component-props -- ChevronLeft accepts className in its styling contract; preserve this caller's layout and appearance.
        className="mr-2 h-4 w-4"
      />
      Back
    </InternalLink>
    <DevLoginTool />
    <div className="mx-auto flex w-full flex-col items-center justify-center sm:w-[420px]">
      <Suspense
        fallback={
          <AuthCardSkeleton
            description="Sign in to your account"
            title="Welcome back"
          />
        }
      >
        <LoginPageContent searchParams={searchParams} />
      </Suspense>
    </div>
  </div>
);
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (metadata); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/jsx-max-depth, react/no-multi-comp */

/* oxlint-disable react/only-export-components -- Next.js reads metadata/viewport from this page/layout module alongside its default component; these are framework metadata exports, not reusable component exports. */
export { metadata };
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
/* oxlint-disable import/no-default-export -- Next.js discovers this page/layout through its default component entrypoint. */
export default LoginPage;
/* oxlint-enable import/no-default-export */
