"use client";

import { toast } from "sonner";

import { DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import type { UiToolName } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { installedToolNames } from "@/tools/chatjs/installed-features";

import type { ComposerControlProps } from "./control";
import { getToolDisplay } from "./tool-display";

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

const canvasTools = {
  code: "createCodeDocument",
  sheet: "createSheetDocument",
  text: "createTextDocument",
} as const;
const getCanvasTool = () => {
  const kind = (["text", "code", "sheet"] as const).find((entry) =>
    installedToolNames.has(canvasTools[entry])
  );
  return kind ? canvasTools[kind] : undefined;
};
export const CanvasControl = (props: ComposerControlProps) => {
  const tool = getCanvasTool();
  return tool ? <ToolControl {...props} tool={tool} /> : null;
};
export const SearchControl = (props: ComposerControlProps) => (
  <ToolControl {...props} tool="webSearch" />
);
export const ResearchControl = (props: ComposerControlProps) => (
  <ToolControl {...props} tool="deepResearch" />
);
export const ImageControl = (props: ComposerControlProps) => (
  <ToolControl {...props} tool="generateImage" />
);
export const VideoControl = (props: ComposerControlProps) => (
  <ToolControl {...props} tool="generateVideo" />
);

CanvasControl.isAvailable = () => Boolean(getCanvasTool());
SearchControl.isAvailable = () => installedToolNames.has("webSearch");
ResearchControl.isAvailable = () => installedToolNames.has("deepResearch");
ImageControl.isAvailable = () => installedToolNames.has("generateImage");
VideoControl.isAvailable = () => installedToolNames.has("generateVideo");
