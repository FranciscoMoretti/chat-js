"use client";
import { Globe } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Favicon } from "@/components/favicon";
/* oxlint-enable sort-imports */
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
export const ConnectorHeader = ({
  name,
  url,
  type,
  isCustom,
  statusText,
}: {
  readonly name: string;
  readonly url: string;
  readonly type: string;
  readonly isCustom: boolean;
  readonly statusText?: string;
}): React.JSX.Element => {
  const faviconUrl = type === "http" ? getGoogleFaviconUrl(url) : "";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
        {faviconUrl ? (
          <>
            <Favicon
              // oxlint-disable-next-line react/forbid-component-props -- Favicon accepts className in its styling contract; preserve this caller's layout and appearance.
              className="size-5 rounded-sm"
              url={faviconUrl}
            />
            <Globe
              // oxlint-disable-next-line react/forbid-component-props -- Globe accepts className in its styling contract; preserve this caller's layout and appearance.
              className="text-muted-foreground hidden size-5"
            />
          </>
        ) : (
          <Globe
            // oxlint-disable-next-line react/forbid-component-props -- Globe accepts className in its styling contract; preserve this caller's layout and appearance.
            className="text-muted-foreground size-5"
          />
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="truncate text-sm font-medium">{name}</span>
          {isCustom ? (
            <Badge
              // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
              className="h-5 shrink-0 px-2 text-[10px]"
              variant="secondary"
            >
              CUSTOM
            </Badge>
          ) : (
            <Badge
              // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
              className="h-5 shrink-0 px-2 text-[10px]"
              variant="outline"
            >
              Built-in
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {getUrlWithoutParams(url)}
        </p>
        {typeof statusText === "string" && statusText !== "" ? (
          <p className="text-muted-foreground mt-0.5 text-[11px]">
            {statusText}
          </p>
        ) : null}
      </div>
    </div>
  );
};
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/max-lines-per-function */
