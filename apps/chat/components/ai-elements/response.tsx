"use client";

import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { memo } from "react";
/* oxlint-enable sort-imports */
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "streamdown/styles.css";
/* oxlint-enable sort-imports */

const plugins = { code, math, mermaid };

type ResponseProps = ComponentProps<typeof Streamdown>;
/* oxlint-disable typescript/prefer-readonly-parameter-types -- Response: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ResponseProps). */

const Response = memo(
  ({ className, ...props }: ResponseProps): React.JSX.Element => (
    <Streamdown
      // oxlint-disable-next-line react/forbid-component-props -- Streamdown accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={plugins}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Response's Streamdown prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.mode === nextProps.mode
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */

Response.displayName = "Response";
export { Response };
