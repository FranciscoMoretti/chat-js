import { memo } from "react";

import { TableCell, TableRow } from "@/components/ui/table";
import { AVAILABLE_FEATURES } from "@/lib/features-config";
import { cn } from "@/lib/utils";

import { ModelSelectorLogo } from "../model-selector-logo";
import { Switch } from "../ui/switch";

export const ModelRow = memo(
  ({
    model,
    isEnabled,
    onToggle,
  }: {
    model: { id: string; name: string; reasoning?: boolean };
    isEnabled: boolean;
    onToggle: (modelId: string, isEnabled: boolean) => void;
  }) => {
    const ReasoningIcon = AVAILABLE_FEATURES.reasoning.icon;

    return (
      <TableRow>
        <TableCell className="w-full py-2.5 pl-0">
          <div className="flex items-center gap-2.5">
            <ModelSelectorLogo modelId={model.id} />
            <span className="text-sm font-medium">{model.name}</span>
            {model.reasoning && (
              <ReasoningIcon
                aria-label={AVAILABLE_FEATURES.reasoning.description}
                className={cn(
                  "text-muted-foreground size-3.5",
                  isEnabled && "text-foreground"
                )}
              />
            )}
          </div>
        </TableCell>
        <TableCell className="py-2.5 pr-0">
          <Switch
            checked={isEnabled}
            onCheckedChange={() => onToggle(model.id, isEnabled)}
          />
        </TableCell>
      </TableRow>
    );
  }
);

ModelRow.displayName = "PureModelRow";
