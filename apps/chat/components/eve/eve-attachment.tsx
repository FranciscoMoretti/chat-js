"use client";

import type { EveMessagePart } from "eve/client";
import React, { useEffect, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";
/* oxlint-disable init-declarations, max-lines-per-function, no-undefined, react-perf/jsx-no-new-array-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveAttachment: ; init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including source?.startsWith("data:")). */

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
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return () => {
      disposed = true;
      if (typeof objectUrl === "string" && objectUrl !== "") {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [source]);
  let url = source;
  if (source?.startsWith("data:")) {
    url = resolved?.source === source ? resolved.url : undefined;
  }
  return typeof url === "string" && url !== "" ? (
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
/* oxlint-enable init-declarations, max-lines-per-function, no-undefined, react-perf/jsx-no-new-array-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
