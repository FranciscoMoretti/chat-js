"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";

import { toolDefinitions } from "@/components/chat-features-definitions";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { installedToolNames } from "@/tools/chatjs/installed-features";

import type { ComposerControlProps } from "./control";

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
}: ComposerControlProps & { tool: UiToolName }) => {
  const { data: session } = useSession();
  const { getModelById } = useChatModels();
  if (!installedToolNames.has(tool)) {
    return null;
  }
  const model = getModelById(selectedModelId);
  const definition = toolDefinitions[tool];
  const Icon = definition.icon;
  const checked =
    selectedTool === tool ||
    Boolean(tool.endsWith("Document") && selectedTool?.endsWith("Document"));
  const unsupported = !model || model.toolCall === false;
  return (
    <DropdownMenuItem
      data-selected={checked}
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
      {checked && <Check aria-label="Selected" className="ml-auto" />}
    </DropdownMenuItem>
  );
};

const canvasTools = {
  code: "createCodeDocument",
  sheet: "createSheetDocument",
  text: "createTextDocument",
} as const;
const getCanvasTool = () => {
  const kind = (["text", "code", "sheet"] as const).find(
    (entry) =>
      config.ai.tools.documents.types[entry] &&
      installedToolNames.has(canvasTools[entry])
  );
  return kind ? canvasTools[kind] : undefined;
};
export const CanvasControl = (props: ComposerControlProps) => {
  const tool = getCanvasTool();
  return config.ai.tools.documents.enabled && tool ? (
    <ToolControl {...props} tool={tool} />
  ) : null;
};
export const SearchControl = (props: ComposerControlProps) =>
  config.ai.tools.webSearch.enabled ? (
    <ToolControl {...props} tool="webSearch" />
  ) : null;
export const ResearchControl = (props: ComposerControlProps) =>
  config.ai.tools.deepResearch.enabled ? (
    <ToolControl {...props} tool="deepResearch" />
  ) : null;
export const ImageControl = (props: ComposerControlProps) =>
  config.ai.tools.image.enabled ? (
    <ToolControl {...props} tool="generateImage" />
  ) : null;
export const VideoControl = (props: ComposerControlProps) =>
  config.ai.tools.video.enabled ? (
    <ToolControl {...props} tool="generateVideo" />
  ) : null;

CanvasControl.isAvailable = () =>
  config.ai.tools.documents.enabled && Boolean(getCanvasTool());
SearchControl.isAvailable = () =>
  config.ai.tools.webSearch.enabled && installedToolNames.has("webSearch");
ResearchControl.isAvailable = () =>
  config.ai.tools.deepResearch.enabled &&
  installedToolNames.has("deepResearch");
ImageControl.isAvailable = () =>
  config.ai.tools.image.enabled && installedToolNames.has("generateImage");
VideoControl.isAvailable = () =>
  config.ai.tools.video.enabled && installedToolNames.has("generateVideo");
