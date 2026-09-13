import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDomainFromUrl, getFaviconUrl } from "@/lib/url-utils";
import type { SearchResultItem } from "@/tools/platform/research-updates-schema";

import { Favicon } from "./favicon";

export const WebSourceBadge = ({ result }: { result: SearchResultItem }) => (
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
