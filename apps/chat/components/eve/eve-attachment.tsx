"use client";

import type { EveMessagePart } from "eve/client";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useEffect, useState } from "react";
/* oxlint-enable sort-imports */

import { AttachmentList } from "@/components/attachment-list";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveAttachment); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable init-declarations, max-lines-per-function, no-undefined, react-perf/jsx-no-new-array-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveAttachment: ; init-declarations: branches initialize this value before use; an eager undefined initializer adds a second missing-value state; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; ; react-perf/jsx-no-new-array-as-prop: these props derive from the current render; sharing or memoizing them requires a separate identity contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including source?.startsWith("data:")). */

export const EveAttachment = ({
  part,
}: {
  part: Extract<EveMessagePart, { type: "file" }>;
}): ReactJSX.Element => {
  const [resolved, setResolved] = useState<{ source: string; url: string }>();
  const source = part.url;
  useEffect(() => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from source; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (!source?.startsWith("data:")) {
      return;
    }
    let disposed = false;
    let objectUrl: string | undefined;
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve resolveAttachment's awaited sequencing and rejected-Promise behavior. */
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
    /* oxlint-enable oxc/no-async-await */
    void resolveAttachment();
    // oxlint-disable-next-line typescript/consistent-return -- #580: This effect returns cleanup only when it installed an active resource; inactive branches intentionally return nothing.
    return (): void => {
      disposed = true;
      if (typeof objectUrl === "string" && objectUrl !== "") {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [source]);
  let url = source;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from source; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (source?.startsWith("data:")) {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading source from resolved; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable init-declarations, max-lines-per-function, no-undefined, react-perf/jsx-no-new-array-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
