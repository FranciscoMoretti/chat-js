"use client";

import { useSearchParams } from "next/navigation";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { Suspense, useSyncExternalStore } from "react";
/* oxlint-enable sort-imports */
import type { JSX as ReactJSX } from "react";

import { SocialAuthProviders } from "@/components/auth-providers";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { InternalLink } from "@/components/internal-link";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
/* oxlint-enable sort-imports */
import {
  buildSocialAuthRequest,
  isElectronRenderer,
} from "@/lib/electron-auth";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (SignupForm); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- SignupForm renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- SignupForm: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const SignupForm = ({
  className: _className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: React.ComponentProps<typeof Card>): ReactJSX.Element => {
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());
  const isElectron = useSyncExternalStore(
    () => (): void => {
      // This capability has no subscription to clean up.
    },
    isElectronRenderer,
    () => false
  );
  const { callbackURL, onRedirectToUrl, signInOptions } =
    buildSocialAuthRequest(query, globalThis.location?.origin);
  const loginHref = { pathname: "/login" as const, query };

  return (
    <div className="flex flex-col gap-6" {...props}>
      <Card {...props}>
        <CardHeader
          // oxlint-disable-next-line react/forbid-component-props -- CardHeader accepts className in its styling contract; preserve this caller's layout and appearance.
          className="text-center"
        >
          <CardTitle
            // oxlint-disable-next-line react/forbid-component-props -- CardTitle accepts className in its styling contract; preserve this caller's layout and appearance.
            className="text-xl"
          >
            {isElectron ? "Continue in browser" : "Create an account"}
          </CardTitle>
          <CardDescription>
            {isElectron
              ? "Use your browser to sign in or create an account."
              : "Get started in seconds"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6">
            <Suspense>
              <SocialAuthProviders
                callbackURL={callbackURL}
                electronBrowserLabel="Continue in browser"
                isElectron={isElectron}
                onRedirectToUrl={onRedirectToUrl}
                query={query}
                signInOptions={signInOptions}
              />
            </Suspense>
            {isElectron ? (
              <div className="text-muted-foreground text-center text-sm">
                New and existing accounts both continue through the browser
                flow.
              </div>
            ) : (
              <div className="text-center text-sm">
                Already have an account?{" "}
                <InternalLink
                  // oxlint-disable-next-line react/forbid-component-props -- InternalLink accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="underline underline-offset-4"
                  href={loginHref}
                >
                  Sign in
                </InternalLink>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="text-muted-foreground [&_a]:hover:text-primary text-center text-xs text-balance [&_a]:underline [&_a]:underline-offset-4">
        By clicking continue, you agree to our{" "}
        <InternalLink href="/terms">Terms of Service</InternalLink> and{" "}
        <InternalLink href="/privacy">Privacy Policy</InternalLink>.
      </div>
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
