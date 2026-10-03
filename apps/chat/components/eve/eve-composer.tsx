"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";

import { ActiveTool } from "@/components/composer/active-tool";
import { ComposerMenu } from "@/components/composer/composer-menu";
import { ContextBar } from "@/components/context-bar";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import { expandSelectedModelValue } from "@/lib/ai/types";
import type { UiToolName } from "@/lib/ai/types";
import type { DraftAttachment } from "@/lib/eve/draft";
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";
import { installedToolNames } from "@/tools/chatjs/installed-features";

import { EveModelPicker } from "./eve-model-picker";
import type { useEveAttachments } from "./use-eve-attachments";

const uploadsOmitted = () => {
  // Uploads are omitted from this installation.
};
const modelSelectionIds = (
  retained: string | undefined,
  selection: Parameters<typeof expandSelectedModelValue>[0] | undefined,
  selected: Parameters<typeof expandSelectedModelValue>[0]
) => (retained ? [retained] : expandSelectedModelValue(selection ?? selected));

const unsupportedAttachments = (
  models: ReturnType<ReturnType<typeof useChatModels>["getModelById"]>[],
  files: DraftAttachment[]
) =>
  models.some((model) =>
    files.some((file) =>
      file.contentType === "application/pdf"
        ? !model?.input.pdf
        : !model?.input.image
    )
  );

const isUnavailableTool = (tool: UiToolName | null) =>
  Boolean(tool && !installedToolNames.has(tool));

export const EveComposer = ({
  files,
  retainedModelId,
  retainedModelIds,
  modelSelection,
  selectedTool,
  onToolChange,
  ...props
}: Omit<
  ComponentProps<typeof ControlledChatComposer>,
  "tools" | "attachments" | "hasAttachments" | "onPaste"
> & {
  files: ReturnType<typeof useEveAttachments>;
  selectedTool: UiToolName | null;
  onToolChange: Dispatch<SetStateAction<UiToolName | null>>;
  retainedModelId?: string;
  retainedModelIds?: string[];
  modelSelection?: ComponentProps<typeof EveModelPicker>["modelSelection"];
}) => {
  const selected = useDefaultModel();
  const { getModelById } = useChatModels();
  const models = modelSelectionIds(
    retainedModelId,
    modelSelection?.value,
    selected
  ).map((modelId) => getModelById(modelId));
  const unsupported =
    !props.readOnly && unsupportedAttachments(models, files.attachments);
  const unavailableTool = isUnavailableTool(selectedTool);
  const locked = props.disabled || files.uploadQueue.length > 0;
  const uploadLocked = locked || props.readOnly;
  const removeAttachment = (attachment: { url: string }) => {
    files.setAttachments((current) =>
      current.filter((file) => file.url !== attachment.url)
    );
  };
  const uploads = files.composer?.(Boolean(uploadLocked));
  return (
    <div
      {...{
        "aria-label": "Message composer",
        role: "group",
        ...uploads?.rootProps,
      }}
    >
      {uploads?.input}
      <ControlledChatComposer
        {...props}
        attachments={
          <ContextBar
            attachments={files.attachments}
            onRemoveAction={uploadLocked ? undefined : removeAttachment}
            uploadQueue={files.uploadQueue}
          />
        }
        disabled={locked || unsupported || unavailableTool}
        hasAttachments={files.attachments.length > 0}

        // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: These independent conditions are combined as a boolean disjunction, not a nullish fallback.

        // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Falsy state or empty error text intentionally selects the existing fallback; coalescing would retain the empty value.
        tools={
          <>
            <ComposerMenu
              disabled={uploadLocked}
              selectedModelId={models[0]?.id ?? ""}
              selectedTool={selectedTool}
              onToolChange={onToolChange}
              onAttach={uploads?.onAttach ?? uploadsOmitted}
            />
            <ActiveTool
              selectedTool={selectedTool}
              disabled={uploadLocked}
              onClear={() => onToolChange(null)}
            />
            <EveModelPicker
              // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: These flags express independent truthy conditions, not a nullish fallback.
              disabled={locked || props.readOnly || Boolean(retainedModelId)}
              modelSelection={modelSelection}
              retainedModelId={retainedModelId}
              retainedModelIds={retainedModelIds}
            />
          </>
        }
      />
      {unavailableTool && (
        <p className="text-destructive text-sm" role="alert">
          The selected tool is unavailable. Clear it or choose another tool
          before sending.
        </p>
      )}
      {unsupported && (
        <p className="text-destructive text-sm" role="alert">
          Choose models that support all attached files.
        </p>
      )}
    </div>
  );
};
