import type React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Favicon); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-props-no-spreading -- Favicon: ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes */

export const Favicon = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    url,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes url, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: {
    readonly url: string;
    readonly className?: string;
  } & React.ImgHTMLAttributes<HTMLImageElement>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  // oxlint-disable-next-line next/no-img-element -- Favicon forwards React.ImgHTMLAttributes, including caller srcSet and string dimensions; installed Next Image drops srcSet and rejects percentage widths even when unoptimized. Preserve this native attribute contract.
  <img
    className={cn("h-4 w-4", className)}
    height={16}
    src={url}
    width={16}
    {...props}
    alt={`Favicon for ${url}`}
    onError={(
      /* oxlint-disable typescript/prefer-readonly-parameter-types -- The image error handler writes event.currentTarget.style.display on the original DOM element. */
      event
      /* oxlint-enable typescript/prefer-readonly-parameter-types */
    ) => {
      const target = event.currentTarget;
      target.style.display = "none";
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading classList from target.nextElementSibling; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      target.nextElementSibling?.classList.remove("hidden");
    }}
  />
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading */
