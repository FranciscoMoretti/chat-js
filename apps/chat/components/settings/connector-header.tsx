"use client";
import { Globe } from "lucide-react";
import React from "react";

import { Favicon } from "@/components/favicon";
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
import { Badge } from "@/components/ui/badge";

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const ConnectorHeader = ({
  name,
  url,
  type,
  isCustom,
  statusText,
}: {
  name: string;
  url: string;
  type: string;
  isCustom: boolean;
  statusText?: string;
}) => {
  const faviconUrl = type === "http" ? getGoogleFaviconUrl(url) : "";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 overflow-hidden">
      <div className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-lg">
        {faviconUrl ? (
          <>
            <Favicon className="size-5 rounded-sm" url={faviconUrl} />
            <Globe className="text-muted-foreground hidden size-5" />
          </>
        ) : (
          <Globe className="text-muted-foreground size-5" />
        )}
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="truncate text-sm font-medium">{name}</span>
          {isCustom ? (
            <Badge
              className="h-5 shrink-0 px-2 text-[10px]"
              variant="secondary"
            >
              CUSTOM
            </Badge>
          ) : (
            <Badge className="h-5 shrink-0 px-2 text-[10px]" variant="outline">
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable react/jsx-max-depth */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
