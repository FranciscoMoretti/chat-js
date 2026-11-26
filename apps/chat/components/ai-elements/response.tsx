"use client";

import "streamdown/styles.css";

import React, { memo, useMemo } from "react";
import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { code } from "@streamdown/code";
import { useMarkdownPlugins } from "@/chatjs/core/ui/slots";

type ResponseProps = ComponentProps<typeof Streamdown>;

const ResponseComponent = ({
  className,
  ...props
}: ResponseProps): React.JSX.Element => {
  const markdown = useMarkdownPlugins();
  const plugins = useMemo(() => ({ code, ...markdown }), [markdown]);
  return (
    <Streamdown
      className={cn(
        "w-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={plugins}
      {...props}
    />
  );
};

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
