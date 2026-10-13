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

const metadata: Metadata = {
  description: "Login to your account",
  title: "Login",
};

const LoginPageContent = async ({
  searchParams,
}: {
  readonly searchParams: Readonly<
    Promise<Readonly<Record<string, string | readonly string[] | undefined>>>
  >;
}): Promise<React.JSX.Element> => {
  const resolvedSearchParams = await searchParams;
  const query = toSearchParamRecord(resolvedSearchParams);
  const isElectronTransfer =
    config.desktopApp.enabled && query.client_id === ELECTRON_AUTH_CLIENT_ID;
  if (isElectronTransfer) {
    const session = await auth.api.getSession({ headers: await headers() });

    if (session?.user) {
      return <ElectronTransferUser query={query} session={session} />;
    }
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

const LoginPage = ({
  searchParams,
}: {
  readonly searchParams: Readonly<
    Promise<Readonly<Record<string, string | readonly string[] | undefined>>>
  >;
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

export { metadata };
export default LoginPage;
