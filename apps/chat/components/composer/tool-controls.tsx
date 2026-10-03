"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";
import { toast } from "sonner";

import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { installedToolNames } from "@/tools/chatjs/installed-features";

import type { ComposerControlProps } from "./control";
import { getToolDisplay } from "./tool-display";
/* oxlint-enable sort-imports */

const loginPrompt = (
  <LoginPrompt
    title="Sign in to use tools"
    description="Sign in to use this feature in your conversation."
  />
);
/* oxlint-disable oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- ToolControl: oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including selectedTool?.endsWith("Document")); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including disabled); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ToolControl = ({
  tool,
  disabled,
  selectedModelId,
  selectedTool,
  onToolChange,
}: ComposerControlProps & { tool: UiToolName }) => {
  const { data: session } = useSession();
  const { getModelById } = useChatModels();
  const definition = getToolDisplay(tool);
  if (!installedToolNames.has(tool) || !definition) {
    return null;
  }
  const model = getModelById(selectedModelId);
  const Icon = definition.icon;
  const checked =
    selectedTool === tool ||
    Boolean(tool.endsWith("Document") && selectedTool?.endsWith("Document"));
  const unsupported = !model || model.toolCall === false;
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      className="pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto"

      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: These independent conditions are combined as a boolean disjunction, not a nullish fallback.
      disabled={disabled || (!checked && unsupported)}
      onSelect={() => {
        if (checked) {
          onToolChange(null);
          return;
        }
        if (!session?.user) {
          toast(loginPrompt);
          return;
        }
        onToolChange(tool);
      }}
    >
      <Icon />
      <span>
        {definition.name}
        {!checked && unsupported && (
          <span className="text-muted-foreground block text-xs">
            (not supported)
          </span>
        )}
      </span>
    </DropdownMenuCheckboxItem>
  );
};
/* oxlint-enable oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

const canvasTools = {
  code: "createCodeDocument",
  sheet: "createSheetDocument",
  text: "createTextDocument",
} as const;
/* oxlint-disable no-ternary, no-undefined, typescript/explicit-function-return-type -- getCanvasTool: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including kind ? canvasTools[kind] : undefined); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const getCanvasTool = () => {
  const kind = (["text", "code", "sheet"] as const).find((entry) =>
    installedToolNames.has(canvasTools[entry])
  );
  return kind ? canvasTools[kind] : undefined;
};
/* oxlint-enable no-ternary, no-undefined, typescript/explicit-function-return-type */
/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, no-ternary, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- CanvasControl: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including tool ? <ToolControl {...props} tool={tool} /> : null); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const CanvasControl = (props: ComposerControlProps) => {
  const tool = getCanvasTool();
  return tool ? <ToolControl {...props} tool={tool} /> : null;
};
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, no-ternary, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SearchControl: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
export const SearchControl = (
  props: ComposerControlProps
): React.JSX.Element => <ToolControl {...props} tool="webSearch" />;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ResearchControl: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
export const ResearchControl = (
  props: ComposerControlProps
): React.JSX.Element => <ToolControl {...props} tool="deepResearch" />;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ImageControl: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
export const ImageControl = (
  props: ComposerControlProps
): React.JSX.Element => <ToolControl {...props} tool="generateImage" />;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- VideoControl: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
export const VideoControl = (
  props: ComposerControlProps
): React.JSX.Element => <ToolControl {...props} tool="generateVideo" />;
/* oxlint-enable import/exports-last, import/group-exports, import/no-named-export, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/explicit-function-return-type -- tool-controls route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

CanvasControl.isAvailable = () => Boolean(getCanvasTool());
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- tool-controls route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
SearchControl.isAvailable = () => installedToolNames.has("webSearch");
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- tool-controls route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
ResearchControl.isAvailable = () => installedToolNames.has("deepResearch");
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- tool-controls route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
ImageControl.isAvailable = () => installedToolNames.has("generateImage");
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- tool-controls route: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
VideoControl.isAvailable = () => installedToolNames.has("generateVideo");
/* oxlint-enable typescript/explicit-function-return-type */
