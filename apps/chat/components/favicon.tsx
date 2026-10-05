import type React from "react";

import { cn } from "@/lib/utils";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Favicon); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- Favicon: ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

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
    onError={(event) => {
      const target = event.currentTarget;
      target.style.display = "none";
      target.nextElementSibling?.classList.remove("hidden");
    }}
  />
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
