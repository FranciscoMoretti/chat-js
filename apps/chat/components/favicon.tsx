import type React from "react";

import { cn } from "@/lib/utils";

export const Favicon = ({
  url,
  className,
  ...props
}: {
  url: string;
  className?: string;
} & React.ImgHTMLAttributes<HTMLImageElement>) => (
  <img
    className={cn("h-4 w-4", className)}
    height={16}
    src={url}
    width={16}
    {...props}
    alt={`Favicon for ${url}`}
    onError={(e) => {
      const target = e.target as HTMLImageElement;
      target.style.display = "none";
      target.nextElementSibling?.classList.remove("hidden");
    }}
  />
);
