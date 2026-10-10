"use client";

import "streamdown/styles.css";

import React, { memo } from "react";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

const plugins = { code, math, mermaid };

type ResponseProps = ComponentProps<typeof Streamdown>;

const Response = memo(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props }: ResponseProps
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): React.JSX.Element => (
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
  (
    prevProps: {
      readonly children?: string | undefined;
      readonly isAnimating?: boolean | undefined;
      readonly mode?: "static" | "streaming" | undefined;
    },
    nextProps: {
      readonly children?: string | undefined;
      readonly isAnimating?: boolean | undefined;
      readonly mode?: "static" | "streaming" | undefined;
    }
  ) =>
    prevProps.children === nextProps.children &&
    prevProps.isAnimating === nextProps.isAnimating &&
    prevProps.mode === nextProps.mode
);

Response.displayName = "Response";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Response); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { Response };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
