"use client";

import Image from "next/image";
import { useState } from "react";
import type React from "react";

import { cn } from "@/lib/utils";

const FaviconImage = ({
  url,
  alt,
  className,
  fallback = null,
  style,
  referrerPolicy,
}: {
  readonly url: string;
  readonly alt?: string;
  readonly className?: string;
  readonly fallback?: React.ReactNode;
  readonly style?: React.CSSProperties;
  readonly referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}): React.ReactNode => {
  const [failed, setFailed] = useState(false);

  if (url === "" || failed) {
    return fallback;
  }

  return (
    <Image
      alt={alt ?? `Favicon for ${url}`}
      className={cn("h-4 w-4", className)}
      height={16}
      loading="eager"
      onError={() => {
        setFailed(true);
      }}
      referrerPolicy={referrerPolicy}
      src={url}
      style={style}
      // Favicons are tiny and can come from arbitrary search-result domains.
      unoptimized
      width={16}
    />
  );
};

export const Favicon = ({
  url,
  ...props
}: React.ComponentProps<typeof FaviconImage>): React.JSX.Element => (
  <FaviconImage key={url} url={url} {...props} />
);
