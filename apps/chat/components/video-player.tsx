"use client";

import { VideoOff } from "lucide-react";
import { useState } from "react";
import type { Ref } from "react";
import { cn } from "@/lib/utils";

export const VideoPlayer = ({
  src,
  name,
  className,
  ref,
}: {
  readonly src: string;
  readonly name: string;
  readonly className?: string;
  readonly ref?: Ref<HTMLVideoElement>;
}) => {
  const [failedSource, setFailedSource] = useState<string>();
  if (failedSource === src) {
    return (
      <output className="bg-muted/30 text-muted-foreground flex min-h-48 w-full flex-col items-center justify-center gap-2">
        <VideoOff className="size-8" />
        <span>Video unavailable</span>
      </output>
    );
  }
  return (
    // oxlint-disable-next-line jsx-a11y/media-has-caption -- Generated video results do not supply a caption track.
    <video
      ref={ref}
      aria-label={name}
      className={cn("max-h-[70vh] w-full bg-black object-contain", className)}
      controls
      playsInline
      preload="metadata"
      src={src}
      onError={() => {
        setFailedSource(src);
      }}
    />
  );
};
