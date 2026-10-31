import type { ComponentType, ReactNode } from "react";
import { cn } from "cn";

/** Callers omit the row when empty and provide their own attachment cards. */
export const ComposerAttachments = ({
  children,
  className,
  primitives,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly primitives: {
    InputGroupAddon: ComponentType<{
      children?: ReactNode;
      className?: string;
      align: "block-start";
    }>;
  };
}) => (
  <primitives.InputGroupAddon
    align="block-start"
    className={cn("flex-wrap border-b", className)}
  >
    {children}
  </primitives.InputGroupAddon>
);
