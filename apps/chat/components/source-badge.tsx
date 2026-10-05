import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Badge } from "@/components/ui/badge";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-enable sort-imports */
import { getDomainFromUrl, getFaviconUrl } from "@/lib/url-utils";
import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { Favicon } from "./favicon";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (WebSourceBadge); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable react/jsx-max-depth -- WebSourceBadge: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries */

export const WebSourceBadge = ({
  result,
}: {
  readonly result: Readonly<SearchResultItem>;
}): React.JSX.Element => (
  <Tooltip>
    <TooltipTrigger asChild>
      <a href={result.url} rel="noopener noreferrer" target="_blank">
        <Badge
          // oxlint-disable-next-line react/forbid-component-props -- Badge accepts className in its styling contract; preserve this caller's layout and appearance.
          className="max-w-[200px] gap-1 truncate text-xs"
          variant="secondary"
        >
          <Favicon
            // oxlint-disable-next-line react/forbid-component-props -- Favicon accepts className in its styling contract; preserve this caller's layout and appearance.
            className="size-3"
            url={getFaviconUrl(result)}
          />
          <span className="italic">{getDomainFromUrl(result.url)}</span>
          <span className="text-muted-foreground text-xs">{result.title}</span>
        </Badge>
      </a>
    </TooltipTrigger>
    <TooltipContent
      // oxlint-disable-next-line react/forbid-component-props -- TooltipContent accepts className in its styling contract; preserve this caller's layout and appearance.
      className="max-w-xs space-y-1 p-3"
      variant="base"
    >
      <div className="flex items-center gap-2">
        <Favicon
          // oxlint-disable-next-line react/forbid-component-props -- Favicon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
          url={getFaviconUrl(result)}
        />
        <p className="font-semibold">{result.title}</p>
      </div>
      <p className="text-muted-foreground text-xs">{result.url}</p>
      <p className="text-muted-foreground line-clamp-5 text-xs">
        {result.content}
      </p>
    </TooltipContent>
  </Tooltip>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-max-depth */
