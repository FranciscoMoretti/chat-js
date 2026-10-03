/* oxlint-disable import/max-dependencies, sort-imports --
 * import/max-dependencies (#524): import from "lucide-react" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import React, { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { DevLoginTool } from "@/components/dev-login-tool";
import { ElectronTransferUser } from "@/components/electron-auth-ui";
import { InternalLink } from "@/components/internal-link";
import { LoginForm } from "@/components/login-form";
import { buttonVariants } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { config } from "@/lib/config";
import {
  ELECTRON_AUTH_CLIENT_ID,
  toSearchParamRecord,
} from "@/lib/electron-auth";
import { cn } from "@/lib/utils";
/* oxlint-enable import/max-dependencies, sort-imports */

/* oxlint-disable import/exports-last, import/no-named-export, react/only-export-components --
 * import/exports-last (#522): metadata is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/no-named-export (#527): Preserve the named metadata API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * react/only-export-components (#553): metadata is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 */
export const metadata: Metadata = {
  description: "Login to your account",
  title: "Login",
};
/* oxlint-enable import/exports-last, import/no-named-export, react/only-export-components */

/* oxlint-disable no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * no-ternary (#518): LoginPageContent derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): LoginPageContent sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): LoginPageContent handles optional session?.user without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * react-perf/jsx-no-jsx-as-prop (#555): LoginPageContent creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/forbid-component-props (#545): LoginPageContent uses className/style as established component styling interfaces; removing them changes the rendered contract.
 * typescript/explicit-function-return-type (#560): Keep LoginPageContent's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): LoginPageContent accepts { searchParams, }: { searchParams: Promise<Record<string, string | string[] | undefin; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): LoginPageContent preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const LoginPageContent = async ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) => {
  const resolvedSearchParams = await searchParams;
  const query = toSearchParamRecord(resolvedSearchParams);
  const isElectronTransfer =
    config.desktopApp.enabled && query.client_id === ELECTRON_AUTH_CLIENT_ID;
  const session = isElectronTransfer
    ? await auth.api.getSession({ headers: await headers() })
    : null;

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
      <LoginForm className="w-full" />
    </Suspense>
  );
};
/* oxlint-enable no-ternary, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/prefer-readonly-parameter-types --
 * react-perf/jsx-no-jsx-as-prop (#555): LoginPage creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/forbid-component-props (#545): LoginPage uses className/style as established component styling interfaces; removing them changes the rendered contract.
 * react/jsx-max-depth (#548): LoginPage keeps related render components together; extraction changes component, state, and layout boundaries.
 * react/jsx-no-literals (#549): LoginPage owns this page copy; replacing literal text requires a localization/content-management contract.
 * react/no-multi-comp (#552): LoginPage keeps related render components together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): LoginPage accepts { searchParams, }: { searchParams: Promise<Record<string, string | string[] | undefin; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
const LoginPage = ({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): React.JSX.Element => (
  <div className="container mx-auto flex h-dvh w-screen flex-col items-center justify-center">
    <InternalLink
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "absolute top-4 left-4 md:top-8 md:left-8"
      )}
      href="/"
    >
      <ChevronLeft className="mr-2 h-4 w-4" />
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
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): The Next.js or tool loader consumes this default export by its default-export contract.
 */
export default LoginPage;
/* oxlint-enable import/no-default-export */
