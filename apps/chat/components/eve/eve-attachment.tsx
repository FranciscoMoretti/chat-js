"use client";

import type { JSX as ReactJSX } from "react";
import React, { useEffect, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";

export const EveAttachment = ({
  part,
}: {
  readonly part: Extract<ReadonlyEveMessagePart, { readonly type: "file" }>;
}): ReactJSX.Element => {
  const [resolved, setResolved] = useState<{ source: string; url: string }>();
  const source = part.url;
  useEffect((): (() => void) | undefined => {
    if (!(source?.startsWith("data:") === true)) {
      return undefined;
    }
    let disposed = false;
    let objectUrl: string | undefined;
    // Browsers block top-level data URLs. Give the shared Open action a Blob URL.
    const resolveAttachment = async (): Promise<void> => {
      try {
        const response = await fetch(source);
        const blob = await response.blob();
        if (!disposed) {
          objectUrl = URL.createObjectURL(blob);
          setResolved({ source, url: objectUrl });
        }
      } catch {
        setResolved(undefined);
      }
    };
    void resolveAttachment();

    return (): void => {
      disposed = true;
      if (typeof objectUrl === "string" && objectUrl !== "") {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [source]);
  let url = source;
  if (source?.startsWith("data:") === true) {
    url = resolved?.source === source ? resolved.url : undefined;
  }
  if (typeof url === "string" && url !== "") {
    return (
      <AttachmentList
        attachments={[
          {
            contentType: part.mediaType,
            name: part.filename ?? "Attachment",
            url,
          },
        ]}
      />
    );
  }
  return <p>{part.filename ?? "Attachment"}</p>;
};
