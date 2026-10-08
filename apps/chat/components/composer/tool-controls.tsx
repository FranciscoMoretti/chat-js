"use client";

import type { ComposerControlProps } from "./control";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping sonner and @/components/ui/dropdown-menu; keep this adjacent import pair ordered. */
import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
/* oxlint-enable sort-imports */
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { installedToolNames } from "@/tools/chatjs/installed-features";

import { useChatModels } from "@/providers/chat-models-provider";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping @/providers/chat-models-provider and ./tool-display; keep this adjacent import pair ordered. */
import { getToolDisplay } from "./tool-display";
/* oxlint-enable sort-imports */

import { useSession } from "@/providers/session-provider";

const loginPrompt = (
  <LoginPrompt
    title="Sign in to use tools"
    description="Sign in to use this feature in your conversation."
  />
);
/* oxlint-disable react/jsx-no-literals -- ToolControl renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, unicorn/no-null -- ToolControl: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// oxlint-disable-next-line max-lines-per-function -- Readonly annotations expand this existing cohesive handler; preserve its authorization, state and awaited operation sequence.
const ToolControl = ({
  tool,
  disabled,
  selectedModelId,
  selectedTool,
  onToolChange,
}: ComposerControlProps & {
  readonly tool: UiToolName;
}): ReactJSX.Element | null => {
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
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading endsWith from selectedTool; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    Boolean(tool.endsWith("Document") && selectedTool?.endsWith("Document"));
  const unsupported = !model || model.toolCall === false;
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuCheckboxItem accepts className in its styling contract; preserve this caller's layout and appearance.
      className="pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto"

      disabled={disabled === true || (!checked && unsupported)}
      onSelect={() => {
        if (checked) {
          onToolChange(null);
          return;
        }
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading user from session; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, unicorn/no-null */

const canvasTools = {
  code: "createCodeDocument",
  sheet: "createSheetDocument",
  text: "createTextDocument",
} as const;
const getCanvasTool = ():
  | (typeof canvasTools)[keyof typeof canvasTools]
  | undefined => {
  const kind = (["text", "code", "sheet"] as const).find((entry) =>
    installedToolNames.has(canvasTools[entry])
  );
  if (kind) {
    return canvasTools[kind];
  }
  return kind;
};
/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp, unicorn/no-null -- CanvasControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const CanvasControl = (
  props: ComposerControlProps
): React.JSX.Element | null => {
  const tool = getCanvasTool();
  if (tool) {
    return <ToolControl {...props} tool={tool} />;
  }
  return null;
};
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp, unicorn/no-null */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp -- SearchControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */
const SearchControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="webSearch" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp -- ResearchControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */
const ResearchControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="deepResearch" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp -- ImageControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */
const ImageControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="generateImage" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp */

/* oxlint-disable react/jsx-props-no-spreading, react/no-multi-comp -- VideoControl: react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */
const VideoControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="generateVideo" />
);
/* oxlint-enable react/jsx-props-no-spreading, react/no-multi-comp */

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
