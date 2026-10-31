import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import React from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { getDomainFromUrl, getFaviconUrl } from "@/lib/url-utils";
import { Favicon } from "./favicon";

import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

export const WebSourceBadge = ({
  result,
}: {
  readonly result: Readonly<SearchResultItem>;
}): React.JSX.Element => (
  <HoverCard>
    <HoverCardTrigger
      href={result.url}
      rel="noopener noreferrer"
      target="_blank"
      className={cn(
        buttonVariants({ variant: "secondary", size: "sm" }),
        "max-w-50 gap-1"
      )}
    >
      <Favicon alt="" className="size-3 shrink-0" url={getFaviconUrl(result)} />
      <span className="sr-only">{result.title} — </span>
      <span className="truncate">{getDomainFromUrl(result.url)}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </HoverCardTrigger>
    <HoverCardContent className="flex max-w-xs flex-col gap-2">
      <p className="font-medium">{result.title}</p>
      <a
        className="break-all underline"
        href={result.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {result.url}
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <p className="line-clamp-5">{result.content}</p>
    </HoverCardContent>
  </HoverCard>
);
