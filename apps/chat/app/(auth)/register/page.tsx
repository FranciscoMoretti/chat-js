import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth-card-skeleton";
import { SignupForm } from "@/components/signup-form";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an account to get started.",
};

export default function RegisterPage() {
  return (
    <div className="container m-auto flex h-dvh w-screen flex-col items-center justify-center px-4">
      <div className="mx-auto w-full sm:w-[480px]">
        <Suspense
          fallback={
            <AuthCardSkeleton
              description="Get started in seconds"
              title="Create an account"
            />
          }
        >
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
