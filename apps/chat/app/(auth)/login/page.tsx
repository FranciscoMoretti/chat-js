import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { DevLoginTool } from "@/components/dev-login-tool";
import { ElectronTransferUser } from "@/components/electron-auth-ui";
import { InternalLink } from "@/components/internal-link";
import { LoginForm } from "@/components/login-form";
import { buttonVariants } from "@/components/ui/button";
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
import {
  ELECTRON_AUTH_CLIENT_ID,
  toSearchParamRecord,
} from "@/lib/electron-auth";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account",
};

function AuthFormFallback({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mx-auto h-4 w-40" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
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
            <AuthFormFallback
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
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
        <AuthFormFallback
          description="Sign in to your account"
          title="Welcome back"
        />
      }
    >
      <LoginForm className="w-full" />
    </Suspense>
  );
}
