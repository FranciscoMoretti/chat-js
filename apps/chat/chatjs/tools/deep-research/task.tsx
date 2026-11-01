import { Loader2, SearchIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import React from "react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ResearchUpdate } from "@/tools/platform/research-updates-schema";
import { WebSourceBadge } from "@/components/source-badge";

export const ResearchTask = ({
  update,
}: Readonly<{
  update: ReadonlyNativeSurface<ResearchUpdate>;
}>): React.JSX.Element => (
  <div className="group">
    <div className="flex min-w-0 flex-col gap-2">
      {update.type === "web" && update.queries !== undefined && (
        <div className="flex flex-wrap gap-2">
          {update.queries.map((query) => (
            <Badge
              className="bg-muted flex items-center gap-1"
              key={query}
              variant="outline"
            >
              <SearchIcon className="size-3.5" />
              {/* // TODO: Make this size width responsive or accomodate long text in another manner */}
              <span className="max-w-[300px] truncate">{query}</span>
            </Badge>
          ))}
        </div>
      )}
      {/* Search Results: Show only when completed and results exist */}
      {update.type === "web" &&
        update.status === "completed" &&
        update.results && (
          <div className="flex flex-wrap gap-2">
            {update.type === "web" &&
              update.results.map((result) => (
                <WebSourceBadge key={result.url} result={result} />
              ))}
          </div>
        )}
      {/* Search Loading State */}
      {update.type === "web" && update.status === "running" && (
        <div className="py-2">
          <div className="flex items-center gap-3">
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
            <p className="text-muted-foreground text-sm">
              Searching the web...
            </p>
          </div>
        </div>
      )}
      {/* {Thoughts} */}
      {update.type === "thoughts" && (
        <div className="space-y-2">
          <p className="text-foreground text-sm font-light">{update.message}</p>
        </div>
      )}
      {update.type === "writing" &&
        update.message !== undefined &&
        update.message !== "" && (
          <div className="space-y-2">
            <p className="text-foreground text-sm font-light">
              {update.message}
            </p>
          </div>
        )}
    </div>
  </div>
);
