"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

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

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<typeof Card>) {
  const searchParams = useSearchParams();
  const query = Object.fromEntries(searchParams.entries());
  const [isElectron, setIsElectron] = useState(false);
  const { callbackURL, onRedirectToUrl, signInOptions } =
    buildSocialAuthRequest(query, globalThis.location?.origin);
  const loginHref = { pathname: "/login" as const, query };

  useEffect(() => {
    setIsElectron(isElectronRenderer());
  }, []);

  return (
    <div className="flex flex-col gap-6" {...props}>
      <Card {...props}>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">
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
}
