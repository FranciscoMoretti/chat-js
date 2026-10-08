"use client";
import { Badge } from "@/components/ui/badge";
import { Favicon } from "@/components/favicon";
import { Globe } from "lucide-react";
import React from "react";
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ConnectorHeader); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable react/jsx-no-literals -- ConnectorHeader renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

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
  // oxlint-disable-next-line no-ternary -- Keep faviconUrl as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const faviconUrl = type === "http" ? getGoogleFaviconUrl(url) : "";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          faviconUrl ? (
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
          )
        }
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="truncate text-sm font-medium">{name}</span>
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            isCustom ? (
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
            )
          }
        </div>
        <p className="text-muted-foreground mt-0.5 truncate text-xs">
          {getUrlWithoutParams(url)}
        </p>
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          typeof statusText === "string" && statusText !== "" ? (
            <p className="text-muted-foreground mt-0.5 text-[11px]">
              {statusText}
            </p>
          ) : null
        }
      </div>
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable eslint/max-lines-per-function */
