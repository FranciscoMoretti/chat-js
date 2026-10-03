import type React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable id-length, import/no-named-export, import/prefer-default-export, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Favicon: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including target.nextElementSibling?.classList.remove("hidden")); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e). */

export const Favicon = ({
  url,
  className,
  ...props
}: {
  url: string;
  className?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>): React.JSX.Element => (
  // oxlint-disable-next-line next/no-img-element -- Favicon URLs come from arbitrary sites and cannot use Next image configuration.
  <img
    className={cn("h-4 w-4", className)}
    height={16}
    src={url}
    width={16}
    {...props}
    alt={`Favicon for ${url}`}
    onError={(e) => {
      const target = e.currentTarget;
      target.style.display = "none";
      target.nextElementSibling?.classList.remove("hidden");
    }}
  />
);
/* oxlint-enable id-length, import/no-named-export, import/prefer-default-export, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-new-function-as-prop, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
