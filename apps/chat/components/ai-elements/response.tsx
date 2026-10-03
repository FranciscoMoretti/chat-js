"use client";

import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import React, { memo } from "react";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

import "streamdown/styles.css";

const plugins = { code, math, mermaid };

type ResponseProps = ComponentProps<typeof Streamdown>;
/* oxlint-disable import/exports-last, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Response: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: ResponseProps). */

export const Response = memo(
  ({ className, ...props }: ResponseProps): React.JSX.Element => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={plugins}
      {...props}
    />
  ),
  (prevProps, nextProps) =>
    prevProps.children === nextProps.children &&
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.mode === nextProps.mode
);
/* oxlint-enable import/exports-last, react/forbid-component-props, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

Response.displayName = "Response";
