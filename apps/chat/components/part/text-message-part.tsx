"use client";

import { memo } from "react";

import { Response } from "../ai-elements/response";

export const TextMessagePart = memo(
  ({ text, isLoading }: { text: string; isLoading: boolean }) => (
    <Response
      animated={{
        duration: 200, // milliseconds (default: 150)
        stagger: 0,
      }}
      isAnimating={isLoading}
      linkSafety={{ enabled: false }}
      mode={isLoading ? "streaming" : "static"}
    >
      {text}
    </Response>
  )
);
