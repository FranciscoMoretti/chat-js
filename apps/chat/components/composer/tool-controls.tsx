"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installedToolNames } from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComposerControlProps } from "./control";
/* oxlint-enable sort-imports */
import { getToolDisplay } from "./tool-display";

const loginPrompt = (
  <LoginPrompt
    title="Sign in to use tools"
    description="Sign in to use this feature in your conversation."
  />
);
/* oxlint-disable react/jsx-no-literals -- ToolControl renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- ToolControl: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including disabled); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const ToolControl = ({
  tool,
  disabled,
  selectedModelId,
  selectedTool,
  onToolChange,
}: ComposerControlProps & { tool: UiToolName }): ReactJSX.Element | null => {
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
      // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuCheckboxItem accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

const canvasTools = {
  code: "createCodeDocument",
  sheet: "createSheetDocument",
  text: "createTextDocument",
} as const;
/* oxlint-disable no-undefined, typescript/explicit-function-return-type -- getCanvasTool: no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const getCanvasTool = () => {
  const kind = (["text", "code", "sheet"] as const).find((entry) =>
    installedToolNames.has(canvasTools[entry])
  );
  return kind ? canvasTools[kind] : undefined;
};
/* oxlint-enable no-undefined, typescript/explicit-function-return-type */
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- CanvasControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const CanvasControl = (
  props: ComposerControlProps
): React.JSX.Element | null => {
  const tool = getCanvasTool();
  return tool ? <ToolControl {...props} tool={tool} /> : null;
};
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- SearchControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
const SearchControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="webSearch" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ResearchControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
const ResearchControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="deepResearch" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ImageControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
const ImageControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="generateImage" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- VideoControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: ComposerControlProps). */
const VideoControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="generateVideo" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

CanvasControl.isAvailable = (): boolean => Boolean(getCanvasTool());

SearchControl.isAvailable = (): boolean => installedToolNames.has("webSearch");

ResearchControl.isAvailable = (): boolean =>
  installedToolNames.has("deepResearch");

ImageControl.isAvailable = (): boolean =>
  installedToolNames.has("generateImage");

VideoControl.isAvailable = (): boolean =>
  installedToolNames.has("generateVideo");

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (CanvasControl, ImageControl, ResearchControl, SearchControl, VideoControl); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
};
/* oxlint-enable import/no-named-export */
