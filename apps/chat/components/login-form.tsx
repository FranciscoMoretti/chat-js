"use client";

import React, { Suspense, useSyncExternalStore } from "react";

import type { JSX as ReactJSX } from "react";

import { SocialAuthProviders } from "@/components/auth-providers";

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

import { InternalLink } from "@/components/internal-link";

import { cn } from "@/lib/utils";
import { useSearchParams } from "next/navigation";

export const LoginForm = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">): ReactJSX.Element => {
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
  const registerHref = `/register?${new URLSearchParams(query)}` as const;

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
