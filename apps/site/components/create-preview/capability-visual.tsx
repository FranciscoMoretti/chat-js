"use client";

import { useState } from "react";
import { AgentCategoryIcon } from "./agent-category-icon";
import { capabilitySymbol } from "./capability-symbol";
import { capabilityBrandIcon } from "./capability-visuals";

export const CapabilityVisual = ({
  id,
  category = "other",
}: {
  readonly id: string;
  readonly category?: string;
}) => {
  const [failedIcon, setFailedIcon] = useState<string>();
  const icon = capabilityBrandIcon(id);
  const symbol = capabilitySymbol(id);
  const showLogo = icon !== undefined && icon !== failedIcon;
  const fallbackKind = symbol === undefined ? "category" : "symbol";
  return (
    <span
      aria-hidden="true"
      className="bg-muted text-muted-foreground relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md border"
      data-capability-visual={showLogo ? "brand" : fallbackKind}
    >
      {showLogo ? (
        // eslint-disable-next-line nextjs/no-img-element -- Small, bundled brand assets need no image optimization.
        <img
          key={icon}
          src={icon}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          className="size-8 bg-white object-contain p-1.5"
          onError={() => {
            setFailedIcon(icon);
          }}
        />
      ) : (
        (symbol ?? <AgentCategoryIcon category={category} className="size-4" />)
      )}
    </span>
  );
};
