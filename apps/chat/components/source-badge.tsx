import React from "react";

import { Badge } from "@/components/ui/badge";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { getDomainFromUrl, getFaviconUrl } from "@/lib/url-utils";
import { Favicon } from "./favicon";

import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

export const WebSourceBadge = ({
  result,
}: {
  readonly result: Readonly<SearchResultItem>;
}): React.JSX.Element => (
  <Tooltip>
    <TooltipTrigger
      render={
        <a href={result.url} rel="noopener noreferrer" target="_blank">
          <Badge
            className="max-w-[200px] gap-1 truncate text-xs"
            variant="secondary"
          >
            <Favicon className="size-3" url={getFaviconUrl(result)} />
            <span className="italic">{getDomainFromUrl(result.url)}</span>
            <span className="text-xs">{result.title}</span>
          </Badge>
        </a>
      }
    />
    <TooltipContent className="max-w-xs flex-col items-start gap-1 p-3">
      <div className="flex items-center gap-2">
        <Favicon className="size-4" url={getFaviconUrl(result)} />
        <p className="font-semibold">{result.title}</p>
      </div>
      <p className="text-xs">{result.url}</p>
      <p className="line-clamp-5 text-xs">{result.content}</p>
    </TooltipContent>
  </Tooltip>
);
