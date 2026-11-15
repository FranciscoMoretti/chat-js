"use client";

import { defineSlot } from "@/chatjs/core/ui/slots";

/** A display reference, not an access grant. URLs retain their server authorization. */
export interface ArtifactReference {
  readonly fileId?: string;
  readonly url: string;
  readonly name: string;
  /** A MIME type, or a family such as image/* when the producer omits the subtype. */
  readonly mediaType: string;
}

/** Installed viewers contribute actions for supported artifacts; otherwise renders nothing. */
export const ArtifactViewerActions = defineSlot<{
  readonly artifact: ArtifactReference;
  /** Let the originating surface pause playback before a viewer opens. */
  readonly onOpen?: () => void;
}>();
