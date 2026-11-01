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

const ResponseComponent = ({
  className,
  ...props
}: ResponseProps): React.JSX.Element => (
  <Streamdown
    className={cn(
      "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      className
    )}
    plugins={plugins}
    {...props}
  />
);

const Response = memo(
  ResponseComponent,
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
export { Response };
