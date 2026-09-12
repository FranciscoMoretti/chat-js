import { memo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import type {
  Artifact,
  ArtifactActionContext,
  ArtifactMetadata,
} from "@/components/create-artifact";
import {
  codeArtifact,
  getCodeArtifactMetadata,
} from "@/lib/artifacts/code/client";
import {
  getSheetArtifactMetadata,
  sheetArtifact,
} from "@/lib/artifacts/sheet/client";
import { textArtifact } from "@/lib/artifacts/text/client";
import { cn } from "@/lib/utils";

import type { UIArtifact } from "./artifact-panel";
import { Button } from "./ui/button";
import { Toggle } from "./ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface ArtifactActionsProps {
  artifact: UIArtifact;
  currentVersionIndex: number;
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  isCurrentVersion: boolean;
  isReadonly: boolean;
  metadata: ArtifactMetadata;
  mode: "edit" | "diff";
  setMetadata: Dispatch<SetStateAction<ArtifactMetadata>>;
}

const createTypedMetadataSetter =
  <M extends ArtifactMetadata>(
    setMetadata: Dispatch<SetStateAction<ArtifactMetadata>>,
    coerce: (metadata: ArtifactMetadata) => M
  ): Dispatch<SetStateAction<M>> =>
  (value) => {
    setMetadata((current) => {
      const typedCurrent = coerce(current);
      return typeof value === "function" ? value(typedCurrent) : value;
    });
  };

interface TypedArtifactActionsProps<M extends ArtifactMetadata> extends Omit<
  ArtifactActionsProps,
  "metadata" | "setMetadata"
> {
  artifactDefinition: Artifact<string, M>;
  metadata: M;
  setMetadata: Dispatch<SetStateAction<M>>;
}

const TypedArtifactActions = <M extends ArtifactMetadata>({
  artifact,
  artifactDefinition,
  handleVersionChange,
  currentVersionIndex,
  isCurrentVersion,
  mode,
  metadata,
  setMetadata,
  isReadonly,
}: TypedArtifactActionsProps<M>) => {
  const [isLoading, setIsLoading] = useState(false);

  const actionContext: ArtifactActionContext<M> = {
    content: artifact.content,
    currentVersionIndex,
    handleVersionChange,
    isCurrentVersion,
    isReadonly,
    metadata,
    mode,
    setMetadata,
  };

  function isActionDisabled(action: {
    isDisabled?: (context: ArtifactActionContext<M>) => boolean;
  }): boolean {
    if (isLoading || artifact.status === "streaming") {
      return true;
    }
    if (action.isDisabled) {
      return action.isDisabled(actionContext);
    }
    return false;
  }

  return (
    <div className="flex flex-row gap-1">
      {artifactDefinition.actions
        .filter((action) => {
          // Hide editing actions when readonly, keep view/copy actions
          if (isReadonly) {
            return (
              action.description === "View changes" ||
              action.description === "View Previous version" ||
              action.description === "View Next version" ||
              action.description === "Copy to clipboard"
            );
          }
          return true;
        })
        .map((action) => (
          <Tooltip key={action.description}>
            <TooltipTrigger asChild>
              {action.description === "View changes" ? (
                <div>
                  <Toggle
                    className={cn("h-fit", {
                      "p-2": !action.label,
                      "px-2 py-1.5": action.label,
                    })}
                    disabled={isActionDisabled(action)}
                    onClick={async () => {
                      setIsLoading(true);

                      try {
                        await Promise.resolve(action.onClick(actionContext));
                      } catch {
                        toast.error("Failed to execute action");
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    pressed={mode === "diff"}
                  >
                    {action.icon}
                    {action.label}
                  </Toggle>
                </div>
              ) : (
                <Button
                  className={cn("hover:bg-accent h-fit", {
                    "p-2": !action.label,
                    "px-2 py-1.5": action.label,
                  })}
                  disabled={isActionDisabled(action)}
                  onClick={async () => {
                    setIsLoading(true);

                    try {
                      await Promise.resolve(action.onClick(actionContext));
                    } catch {
                      toast.error("Failed to execute action");
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  variant="outline"
                >
                  {action.icon}
                  {action.label}
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>{action.description}</TooltipContent>
          </Tooltip>
        ))}
    </div>
  );
};

export const ArtifactActions = memo(
  (props: ArtifactActionsProps) => {
    switch (props.artifact.kind) {
      case "code": {
        return (
          <TypedArtifactActions
            {...props}
            artifactDefinition={codeArtifact}
            metadata={getCodeArtifactMetadata(props.metadata)}
            setMetadata={createTypedMetadataSetter(
              props.setMetadata,
              getCodeArtifactMetadata
            )}
          />
        );
      }
      case "sheet": {
        return (
          <TypedArtifactActions
            {...props}
            artifactDefinition={sheetArtifact}
            metadata={getSheetArtifactMetadata(props.metadata)}
            setMetadata={createTypedMetadataSetter(
              props.setMetadata,
              getSheetArtifactMetadata
            )}
          />
        );
      }
      case "text": {
        return (
          <TypedArtifactActions
            {...props}
            artifactDefinition={textArtifact}
            metadata={props.metadata}
            setMetadata={props.setMetadata}
          />
        );
      }
      default: {
        throw new Error("Artifact definition not found!");
      }
    }
  },
  (prevProps, nextProps) => {
    if (prevProps.artifact.status !== nextProps.artifact.status) {
      return false;
    }
    if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
      return false;
    }
    if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
      return false;
    }
    if (prevProps.artifact.content !== nextProps.artifact.content) {
      return false;
    }
    if (prevProps.isReadonly !== nextProps.isReadonly) {
      return false;
    }
    if (prevProps.mode !== nextProps.mode) {
      return false;
    }

    return true;
  }
);

ArtifactActions.displayName = "ArtifactActions";
