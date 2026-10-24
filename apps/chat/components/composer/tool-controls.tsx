"use client";

import type { ComposerControlProps } from "./control";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";

import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { installedToolNames } from "@/composition/generated/installed-tools";

import { useChatModels } from "@/providers/chat-models-provider";

import { getToolDisplay } from "./tool-display";

import { useSession } from "@/providers/session-provider";

const loginPrompt = (
  <LoginPrompt
    title="Sign in to use tools"
    description="Sign in to use this feature in your conversation."
  />
);

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
    Boolean(tool.endsWith("Document") && selectedTool?.endsWith("Document"));
  const unsupported = !model || model.toolCall === false;
  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      className="pr-8 pl-2 [&>span:first-child]:right-2 [&>span:first-child]:left-auto"

      disabled={disabled === true || (!checked && unsupported)}
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

const CanvasControl = (
  props: ComposerControlProps
): React.JSX.Element | null => {
  const tool = getCanvasTool();
  if (tool) {
    return <ToolControl {...props} tool={tool} />;
  }
  return null;
};

const SearchControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="webSearch" />
);

const ResearchControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="deepResearch" />
);

const ImageControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="generateImage" />
);

const VideoControl = (props: ComposerControlProps): React.JSX.Element => (
  <ToolControl {...props} tool="generateVideo" />
);

CanvasControl.isAvailable = (): boolean => Boolean(getCanvasTool());

SearchControl.isAvailable = (): boolean => installedToolNames.has("webSearch");

ResearchControl.isAvailable = (): boolean =>
  installedToolNames.has("deepResearch");

ImageControl.isAvailable = (): boolean =>
  installedToolNames.has("generateImage");

VideoControl.isAvailable = (): boolean =>
  installedToolNames.has("generateVideo");

export {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
};
