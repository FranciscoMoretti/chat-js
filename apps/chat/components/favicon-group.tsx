/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import type React from "react";

import { cn } from "@/lib/utils";

import { Favicon } from "./favicon";
/* oxlint-enable sort-imports */

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
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- FaviconGroup: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 4); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including index > 0 ? "-ml-2" : ""); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { sources, maxVisible = 4, className, }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including source.title). */

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
          // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary, react-perf/jsx-no-new-object-as-prop, react/forbid-component-props, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
