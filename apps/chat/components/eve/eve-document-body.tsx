"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import type { DocumentBodyProps } from "@/lib/eve/document-ui";
import { documentUi } from "@/tools/chatjs/document-ui";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- DocumentBody: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including documentUi[kind]?.Body); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const DocumentBody = ({
  kind,
  ...props
}: DocumentBodyProps & {
  kind: "text" | "code" | "sheet";
}) => {
  const Body = documentUi[kind]?.Body;
  return Body ? (
    <Body {...props} />
  ) : (
    <div className="p-4 text-sm">
      <output className="text-muted-foreground">
        The {kind} document editor is not installed. Install {kind}-documents to
        edit this document.
      </output>
      <pre className="mt-3 break-words whitespace-pre-wrap">
        {props.editorProps.content}
      </pre>
    </div>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
