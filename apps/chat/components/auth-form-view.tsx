"use client";
import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InternalLink } from "@/components/internal-link";
import { cn } from "@/lib/utils";

export const AuthFormView = ({
  mode,
  query,
  title,
  description,
  footer,
  children,
  className,
}: {
  readonly mode: "login" | "register";
  readonly query: Readonly<Record<string, string>>;
  readonly title?: string;
  readonly description?: string;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) => (
  <div className={cn("flex flex-col gap-6", className)}>
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {title ?? (mode === "login" ? "Welcome back" : "Create an account")}
        </CardTitle>
        <CardDescription>
          {description ??
            (mode === "login"
              ? "Sign in to your account"
              : "Get started in seconds")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6">
          {children}
          {footer ?? (
            <div className="text-center text-sm">
              {mode === "login"
                ? "Don't have an account? "
                : "Already have an account? "}
              <InternalLink
                className="underline underline-offset-4"
                href={
                  mode === "login"
                    ? `/register?${new URLSearchParams(query)}`
                    : `/login?${new URLSearchParams(query)}`
                }
              >
                {mode === "login" ? "Sign up" : "Sign in"}
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
