import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
/* oxlint-enable sort-imports */
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface AuthCardSkeletonProps {
  readonly title: string;
  readonly description: string;
  readonly className?: string;
  readonly cardClassName?: string;
  readonly variant?: "form" | "device";
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (AuthCardSkeleton); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-max-depth -- AuthCardSkeleton: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const AuthCardSkeleton = ({
  title,
  description,
  className,
  cardClassName,
  variant = "form",
}: AuthCardSkeletonProps): React.JSX.Element => (
  <div className={cn("flex w-full flex-col gap-6", className)}>
    <Card
      // oxlint-disable-next-line react/forbid-component-props -- Card accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cardClassName}
    >
      <CardHeader
        // oxlint-disable-next-line react/forbid-component-props -- CardHeader accepts className in its styling contract; preserve this caller's layout and appearance.
        className="text-center"
      >
        <h1 className="text-xl leading-none font-semibold">{title}</h1>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {variant === "device" ? (
            <>
              <Skeleton
                // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                className="mx-auto size-10 rounded-full"
              />
              <Skeleton
                // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                className="mx-auto h-4 w-56"
              />
              <Skeleton
                // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                className="h-10 w-full"
              />
            </>
          ) : (
            <>
              <Skeleton
                // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                className="h-10 w-full"
              />
              <Skeleton
                // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                className="h-10 w-full"
              />
              <Skeleton
                // oxlint-disable-next-line react/forbid-component-props -- Skeleton accepts className in its styling contract; preserve this caller's layout and appearance.
                className="mx-auto h-4 w-40"
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  </div>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-max-depth */
