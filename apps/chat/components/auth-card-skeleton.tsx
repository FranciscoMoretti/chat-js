/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

interface AuthCardSkeletonProps {
  title: string;
  description: string;
  className?: string;
  cardClassName?: string;
  variant?: "form" | "device";
}
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- AuthCardSkeleton: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const AuthCardSkeleton = ({
  title,
  description,
  className,
  cardClassName,
  variant = "form",
}: AuthCardSkeletonProps): React.JSX.Element => (
  <div className={cn("flex w-full flex-col gap-6", className)}>
    <Card className={cardClassName}>
      <CardHeader className="text-center">
        <h1 className="text-xl leading-none font-semibold">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {variant === "device" ? (
            <>
              <Skeleton className="mx-auto size-10 rounded-full" />
              <Skeleton className="mx-auto h-4 w-56" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="mx-auto h-4 w-40" />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
