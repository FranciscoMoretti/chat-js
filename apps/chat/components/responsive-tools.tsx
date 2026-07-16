import { Settings2, X } from "lucide-react";
import {
  createElement,
  type Dispatch,
  type SetStateAction,
  useState,
} from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import type { UiToolName } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { enabledTools, toolDefinitions } from "./chat-features-definitions";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { LoginPrompt } from "./upgrade-cta/login-prompt";

export function ResponsiveTools({
  tools,
  setTools,
  selectedModelId,
}: {
  tools: UiToolName | null;
  setTools: Dispatch<SetStateAction<UiToolName | null>>;
  selectedModelId: string;
}) {
  const { data: session } = useSession();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const { getModelById } = useChatModels();
  const modelDef = getModelById(selectedModelId);
  const hasUnspecifiedFeatures = !modelDef?.input;

  const activeTool = tools;

  const setTool = (tool: UiToolName | null) => {
    if (hasUnspecifiedFeatures && tool !== null) {
      return;
    }

    if (isAnonymous && tool !== null) {
      setShowLoginPopover(true);
      return;
    }

    setTools(tool);
  };

  return (
    <div className="flex items-center @[500px]:gap-2 gap-1">
      {isAnonymous ? (
        <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
          <PopoverTrigger asChild>
            <Button
              className="@[500px]:h-10 h-8 @[500px]:gap-2 gap-1 p-1.5"
              title="Select Tools"
              variant="ghost"
            >
              <Settings2 size={14} />
              <span className="@[500px]:inline hidden">Tools</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <LoginPrompt
              description="Access web search, deep research, and more to get better answers."
              title="Sign in to use Tools"
            />
          </PopoverContent>
        </Popover>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="@[500px]:h-10 h-8 @[500px]:gap-2 gap-1 p-1.5 px-2.5"
              size="sm"
              title="Select Tools"
              variant="ghost"
            >
              <Settings2 size={14} />
              <span className="@[500px]:inline hidden">Tools</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-48"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {enabledTools.map((key) => {
              const tool = toolDefinitions[key];
              const Icon = tool.icon;
              return (
                <DropdownMenuItem
                  className="flex items-center gap-2"
                  disabled={hasUnspecifiedFeatures}
                  key={key}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTool(tools === key ? null : key);
                  }}
                >
                  <Icon size={14} />
                  <span>{tool.name}</span>
                  {tools === key && (
                    <span className="text-xs opacity-70">✓</span>
                  )}
                  {hasUnspecifiedFeatures && (
                    <span className="text-xs opacity-60">(not supported)</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {activeTool && (
        <>
          <Separator
            className="h-4 bg-muted-foreground/50"
            orientation="vertical"
          />
          <Button
            className="@[500px]:h-10 h-8 @[500px]:gap-2 gap-1 rounded-full text-primary hover:text-primary/80"
            onClick={() => setTool(null)}
            size="sm"
            variant="ghost"
          >
            {createElement(toolDefinitions[activeTool].icon, {
              size: 14,
            })}
            <span className="@[500px]:inline hidden">
              {toolDefinitions[activeTool].shortName}
            </span>
            <X className="opacity-70" size={12} />
          </Button>
        </>
      )}
    </div>
  );
}
