"use client";

import type { EveMessagePart } from "eve/client";
import { useEffect, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";

export const EveAttachment = ({
  part,
}: {
  part: Extract<EveMessagePart, { type: "file" }>;
}) => {
  const [resolved, setResolved] = useState<{ source: string; url: string }>();
  const source = part.url;
  useEffect(() => {
    if (!source?.startsWith("data:")) {
      return;
    }
    let disposed = false;
    let objectUrl: string | undefined;
    // Browsers block top-level data URLs. Give the shared Open action a Blob URL.
    const resolveAttachment = async () => {
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
          contentType: part.mediaType,
          name: part.filename ?? "Attachment",
          url,
        },
      ]}
    />
  ) : (
    <p>{part.filename ?? "Attachment"}</p>
  );
};
