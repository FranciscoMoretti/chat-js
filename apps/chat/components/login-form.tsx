"use client";

import { useSearchParams } from "next/navigation";
import React, { Suspense, useSyncExternalStore } from "react";

import { SocialAuthProviders } from "@/components/auth-providers";
import { InternalLink } from "@/components/internal-link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildSocialAuthRequest,
  isElectronRenderer,
} from "@/lib/electron-auth";
import { cn } from "@/lib/utils";
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- LoginForm: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const LoginForm = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());
  const isElectron = useSyncExternalStore(
    () => () => {
      // This capability has no subscription to clean up.
    },
    isElectronRenderer,
    () => false
  );
  const { callbackURL, onRedirectToUrl, signInOptions } =
    buildSocialAuthRequest(query, globalThis.location?.origin);
  const registerHref = { pathname: "/register" as const, query };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
            {isElectron ? "Continue in browser" : "Welcome back"}
          </CardTitle>
          <CardDescription>
            {isElectron
              ? "Use your browser to sign in or create an account."
              : "Sign in to your account"}
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
                Don&apos;t have an account?{" "}
                <InternalLink
                  className="underline underline-offset-4"
                  href={registerHref}
                >
                  Sign up
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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
