import type React from "react";

import { cn } from "@/lib/utils";

import { Favicon } from "./favicon";

// Define a simpler interface for the sources needed by this component
interface FaviconSource {
  // Title is optional, mainly for alt text
  title?: string;
  url: string;
}

interface FaviconGroupProps {
  className?: string;
  maxVisible?: number;
  // Use the simpler interface
  sources: FaviconSource[];
}

export const FaviconGroup: React.FC<FaviconGroupProps> = ({
  sources,
  maxVisible = 4,
  className,
}) => {
  const visibleSources = sources.slice(0, maxVisible);

  return (
    <div className={cn("flex items-center", className)}>
      {visibleSources.map((source, index) => (
        <Favicon
          alt={`Favicon for ${source.title || new URL(source.url).hostname}`}
          className={cn(
            "border-background h-5 w-5 rounded-full border-2",
            index > 0 ? "-ml-2" : ""
          )}
          key={source.url || index}
          style={{ zIndex: maxVisible - index }}
          url={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`}
        />
      ))}
    </div>
  );
};
