import type React from "react";

import { cn } from "@/lib/utils";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Favicon } from "./favicon";
/* oxlint-enable sort-imports */

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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (FaviconGroup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-object-as-prop -- FaviconGroup: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership */

export const FaviconGroup: React.FC<FaviconGroupProps> = ({
  sources,
  maxVisible = 4,
  className,
}): React.JSX.Element => {
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
          // oxlint-disable-next-line react/forbid-component-props -- Favicon accepts className in its styling contract; preserve this caller's layout and appearance.
          className={cn(
            "border-background h-5 w-5 rounded-full border-2",
            index > 0 ? "-ml-2" : ""
          )}
          key={source.url === "" ? index : source.url}
          // oxlint-disable-next-line react/forbid-component-props -- Favicon accepts style in its styling contract; preserve this caller's layout and appearance.
          style={{ zIndex: maxVisible - index }}
          url={`https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=32`}
        />
      ))}
    </div>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-object-as-prop */
