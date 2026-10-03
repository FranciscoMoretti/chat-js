"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import type { EveMessagePart } from "eve/client";
import React, { useEffect, useState } from "react";

import { AttachmentList } from "@/components/attachment-list";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, init-declarations, max-lines-per-function, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-array-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveAttachment: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including resolved?.source === source ? resolved.url : undefined); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including source?.startsWith("data:")); react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including source?.startsWith("data:")). */

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
/* oxlint-enable import/no-named-export, import/prefer-default-export, init-declarations, max-lines-per-function, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-array-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
