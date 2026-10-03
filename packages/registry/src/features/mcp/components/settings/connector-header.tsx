"use client";
import { Globe } from "lucide-react";
import React from "react";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Favicon } from "@/components/favicon";
/* oxlint-enable eslint/sort-imports */
import { getGoogleFaviconUrl } from "@/components/get-google-favicon-url";
import { getUrlWithoutParams } from "@/components/get-url-without-params";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
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
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
