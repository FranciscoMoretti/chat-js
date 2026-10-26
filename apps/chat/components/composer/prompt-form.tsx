"use client";

import type { ComponentProps, ReactNode, JSX } from "react";
import { InputGroup, InputGroupAddon } from "../ui/input-group";
import { cn } from "cn";

const defaultPrimitives = { InputGroup, InputGroupAddon };

/** Native composer layout shared by runtime editors and browser-only previews. */
export const PromptForm = ({
  children,
  attachments,
  tools,
  actions,
  message,
  editable = true,
  primitives = defaultPrimitives,
  className,
  ...props
}: ComponentProps<"form"> & {
  readonly attachments?: ReactNode;
  readonly tools?: ReactNode;
  readonly actions: ReactNode;
  readonly message?: ReactNode;
  readonly editable?: boolean;
  readonly primitives?: {
    InputGroup: typeof InputGroup;
    InputGroupAddon: typeof InputGroupAddon;
  };
}): JSX.Element => (
  <form className={cn("@container w-full", className)} {...props}>
    <primitives.InputGroup
      className={cn("overflow-hidden", editable && "has-disabled:opacity-100")}
    >
      {children}
      {attachments}
      <primitives.InputGroupAddon
        align="block-end"
        className="min-w-0 justify-between gap-1 @[500px]:gap-2"
      >
        <div className="flex min-w-0 items-center gap-1 @[500px]:gap-2">
          {tools}
        </div>
        {actions}
      </primitives.InputGroupAddon>
    </primitives.InputGroup>
    {message}
  </form>
);
