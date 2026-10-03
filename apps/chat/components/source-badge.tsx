/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDomainFromUrl, getFaviconUrl } from "@/lib/url-utils";
import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

import { Favicon } from "./favicon";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types -- WebSourceBadge: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { result }: { result: SearchResultItem }). */

export const WebSourceBadge = ({
  result,
}: {
  result: SearchResultItem;
}): React.JSX.Element => (
  <Tooltip>
    <TooltipTrigger asChild>
      <a href={result.url} rel="noopener noreferrer" target="_blank">
        <Badge
          className="max-w-[200px] gap-1 truncate text-xs"
          variant="secondary"
        >
          <Favicon className="size-3" url={getFaviconUrl(result)} />
          <span className="italic">{getDomainFromUrl(result.url)}</span>
          <span className="text-muted-foreground text-xs">{result.title}</span>
        </Badge>
      </a>
    </TooltipTrigger>
    <TooltipContent className="max-w-xs space-y-1 p-3" variant="base">
      <div className="flex items-center gap-2">
        <Favicon className="size-4" url={getFaviconUrl(result)} />
        <p className="font-semibold">{result.title}</p>
      </div>
      <p className="text-muted-foreground text-xs">{result.url}</p>
      <p className="text-muted-foreground line-clamp-5 text-xs">
        {result.content}
      </p>
    </TooltipContent>
  </Tooltip>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/forbid-component-props, react/jsx-max-depth, typescript/prefer-readonly-parameter-types */
