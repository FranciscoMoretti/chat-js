import type { Metadata } from "next";
import { Suspense } from "react";
import { SignupForm } from "@/components/signup-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create an account to get started.",
};

function SignupFormFallback() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Create an account</CardTitle>
          <CardDescription>Get started in seconds</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mx-auto h-4 w-48" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div className="container m-auto flex h-dvh w-screen flex-col items-center justify-center px-4">
      <div className="mx-auto w-full sm:w-[480px]">
        <Suspense fallback={<SignupFormFallback />}>
          <SignupForm />
        </Suspense>
      </div>
    </div>
  );
}
