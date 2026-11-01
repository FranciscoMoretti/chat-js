import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import React, { Suspense } from "react";

import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { DevLoginTool } from "@/components/dev-login-tool";
import { InternalLink } from "@/components/internal-link";
import { LoginForm } from "@/components/login-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const metadata: Metadata = {
  description: "Login to your account",
  title: "Login",
};

const LoginPage = (): React.JSX.Element => (
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
        <LoginForm className="w-full" />
      </Suspense>
    </div>
  </div>
);

export { metadata };
export default LoginPage;
