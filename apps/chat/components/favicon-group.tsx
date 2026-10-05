import type React from "react";

import { cn } from "@/lib/utils";

import { Favicon } from "./favicon";

// Define a simpler interface for the sources needed by this component
interface FaviconSource {
  // Title is optional, mainly for alt text
  readonly title?: string;
  readonly url: string;
}

interface FaviconGroupProps {
  readonly className?: string;
  readonly maxVisible?: number;
  // Use the simpler interface
  readonly sources: readonly FaviconSource[];
}
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop -- FaviconGroup: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership */

export const FaviconGroup: React.FC<FaviconGroupProps> = ({
  sources,
  maxVisible = 4,
  className,
}) => {
  const visibleSources = sources.slice(0, maxVisible);

  return (
    <div className={cn("flex items-center", className)}>
      {visibleSources.map((source, index): React.JSX.Element => (
        <Favicon
          alt={`Favicon for ${
            typeof source.title === "string" && source.title !== ""
              ? source.title
              : new URL(source.url).hostname
          }`}
          className={cn(
            "border-background h-5 w-5 rounded-full border-2",
            index > 0 ? "-ml-2" : ""
          )}
          key={source.url === "" ? index : source.url}
          style={{ zIndex: maxVisible - index }}
          url={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`}
        />
      ))}
    </div>
  );
};
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop */
