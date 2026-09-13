"use client";

import type { EveMessagePart } from "eve/client";
import { useEffect, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";

export function EveAttachment({
  part,
}: {
  part: Extract<EveMessagePart, { type: "file" }>;
}) {
  const [resolved, setResolved] = useState<{ source: string; url: string }>();
  const source = part.url;
  useEffect(() => {
    if (!source?.startsWith("data:")) {
      return;
    }
    let disposed = false;
    let objectUrl: string | undefined;
    // Browsers block top-level data URLs. Give the shared Open action a Blob URL.
    fetch(source)
      .then((response) => response.blob())
      .then((blob) => {
        if (!disposed) {
          objectUrl = URL.createObjectURL(blob);
          setResolved({ source, url: objectUrl });
        }
      })
      .catch(() => setResolved(undefined));
    return () => {
      disposed = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [source]);
  let url = source;
  if (source?.startsWith("data:")) {
    url = resolved?.source === source ? resolved.url : undefined;
  }
  return url ? (
    <AttachmentList
      attachments={[
        {
          url,
          name: part.filename ?? "Attachment",
          contentType: part.mediaType,
        },
      ]}
    />
  ) : (
    <p>{part.filename ?? "Attachment"}</p>
  );
}
