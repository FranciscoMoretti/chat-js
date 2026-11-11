"use client";
import { useAvailableTools } from "./tool-availability";

import type { ComposerControlProps } from "./control";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";

import { ToolMenuItem } from "./tool-menu-item";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { installedToolNames } from "@/integrations/tools/catalog";

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
  const available = useAvailableTools();
  const definition = getToolDisplay(tool, available);
  if (!available.has(tool) || !definition) {
    return null;
  }
  const model = getModelById(selectedModelId);
  const Icon = definition.icon;
  const checked =
    selectedTool === tool ||
    Boolean(tool.endsWith("Document") && selectedTool?.endsWith("Document"));
  const unsupported = !model || model.toolCall === false;
  return (
    <ToolMenuItem
      checked={checked}
      disabled={disabled === true || (!checked && unsupported)}
      onActivate={() => {
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
    </ToolMenuItem>
  );
};

const canvasTools = {
  code: "createCodeDocument",
  sheet: "createSheetDocument",
  text: "createTextDocument",
} as const;
const getCanvasTool = (
  available = installedToolNames
): (typeof canvasTools)[keyof typeof canvasTools] | undefined => {
  const kind = (["text", "code", "sheet"] as const).find((entry) =>
    available.has(canvasTools[entry])
  );
  if (kind) {
    return canvasTools[kind];
  }
  return kind;
};

const CanvasControl = (
  props: ComposerControlProps
): React.JSX.Element | null => {
  const available = useAvailableTools();
  const tool = getCanvasTool(available);
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

CanvasControl.isAvailable = (
  _mobile: boolean,
  available = installedToolNames
): boolean => Boolean(getCanvasTool(available));

SearchControl.isAvailable = (
  _mobile: boolean,
  available = installedToolNames
): boolean => available.has("webSearch");

ResearchControl.isAvailable = (
  _mobile: boolean,
  available = installedToolNames
): boolean => available.has("deepResearch");

ImageControl.isAvailable = (
  _mobile: boolean,
  available = installedToolNames
): boolean => available.has("generateImage");

VideoControl.isAvailable = (
  _mobile: boolean,
  available = installedToolNames
): boolean => available.has("generateVideo");

export {
  CanvasControl,
  ImageControl,
  ResearchControl,
  SearchControl,
  VideoControl,
};
