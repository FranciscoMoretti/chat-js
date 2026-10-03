"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import type { EveMessagePart } from "eve/client";
import React from "react";

import { eveMcpResult } from "@/lib/eve/mcp-result";
/* oxlint-disable import/no-relative-parent-imports -- ../part/mcp-tool-result import: import/no-relative-parent-imports: the fixture imports its adjacent feature directly without creating a test-only alias. */

import { McpToolResult } from "../part/mcp-tool-result";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, no-undefined, oxc/no-optional-chaining, react-perf/jsx-no-new-object-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- EveMcpResult: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including result?.success ? result.data.output : undefined); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including result?.success); react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including failed). */

export const EveMcpResult = ({
  part,
  defaultOpen,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  defaultOpen?: boolean;
}) => {
  const result =
    part.state === "output-available"
      ? eveMcpResult.safeParse(part.output)
      : undefined;
  const failed = part.state === "output-error" || (result && !result.success);
  return (
    <McpToolResult
      defaultOpen={defaultOpen}
      part={{
        errorText: failed
          ? "MCP tool failed. Check the connector in settings and try again."
          : undefined,
        input: part.input,
        output: result?.success ? result.data.output : undefined,
        state: failed ? "output-error" : part.state,
        toolName: part.toolName,
      }}
    />
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, no-undefined, oxc/no-optional-chaining, react-perf/jsx-no-new-object-as-prop, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
