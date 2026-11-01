"use client";

import { useAttachmentPicker } from "@/chatjs/core/uploads/use-attachment-picker";

import type {
  ComponentProps,
  Dispatch,
  JSX as ReactJSX,
  SetStateAction,
  ReactNode,
} from "react";
import React from "react";

import { ActiveTool } from "@/components/composer/active-tool";
import { ComposerMenu } from "@/components/composer/composer-menu";
import { ContextBar } from "@/components/context-bar";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import type { UiToolName } from "@/lib/ai/types";
import type { DraftAttachment } from "@/lib/eve/draft";
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";
import { installedToolNames } from "@/integrations/tools/catalog";

import { EveModelPicker } from "./eve-model-picker";
import type { useEveAttachments } from "./use-eve-attachments";

const uploadsOmitted = (): void => {
  // Uploads are omitted from this installation.
};

const unsupportedAttachments = (
  models: readonly ReturnType<
    ReturnType<typeof useChatModels>["getModelById"]
  >[],
  files: readonly Readonly<DraftAttachment>[]
): boolean =>
  models.some((model) =>
    files.some((file) => {
      if (file.contentType === "application/pdf") {
        return !(model?.input.pdf === true);
      }
      return !(model?.input.image === true);
    })
  );

const isUnavailableTool = (tool: UiToolName | null): boolean =>
  tool !== null && !installedToolNames.has(tool);

interface ComposerCapabilities {
  readonly files: Readonly<
    Omit<ReturnType<typeof useEveAttachments>, "attachments" | "uploadQueue">
  > & {
    readonly attachments: readonly Readonly<DraftAttachment>[];
    readonly uploadQueue: readonly string[];
  };
  readonly selectedTool: UiToolName | null;
  readonly onToolChange: Dispatch<SetStateAction<UiToolName | null>>;
}

type ComposerProps = Omit<
  ComponentProps<typeof ControlledChatComposer>,
  "tools" | "attachments" | "hasAttachments" | "onPaste"
> & {
  /** Model IDs used for capability checks; selection state belongs to the caller. */
  readonly modelIds?: readonly string[];
  /** Omit to use the default single-model picker. Inherits the composer lock. */
  readonly modelPicker?: ReactNode;
};

const CapableComposer = ({
  files,
  modelIds,
  modelPicker,
  selectedTool,
  onToolChange,
  ...props
}: ComposerProps & ComposerCapabilities): ReactJSX.Element => {
  const selected = useDefaultModel();
  const { getModelById } = useChatModels();
  const models = (modelIds ?? [selected]).map((modelId) =>
    getModelById(modelId)
  );
  const unsupported =
    !(props.readOnly === true) &&
    unsupportedAttachments(models, files.attachments);
  const unavailableTool = isUnavailableTool(selectedTool);
  const locked = props.disabled || files.uploadQueue.length > 0;
  const uploadLocked = locked || props.readOnly;
  const removeAttachment = (attachment: { readonly url: string }): void => {
    files.setAttachments((current: readonly Readonly<DraftAttachment>[]) =>
      current.filter((file) => file.url !== attachment.url)
    );
  };
  const uploads = useAttachmentPicker({
    disabled: Boolean(uploadLocked) || !files.enabled,
    onFiles: files.enqueue,
  });
  return (
    <div
      {...{
        "aria-label": "Message composer",
        role: "group",
        ...uploads.rootProps,
      }}
    >
      {files.enabled && <input {...uploads.inputProps} />}
      <ControlledChatComposer
        {...props}
        attachments={
          <ContextBar
            attachments={files.attachments}
            onRemoveAction={
              uploadLocked === true ? undefined : removeAttachment
            }
            uploadQueue={files.uploadQueue}
          />
        }
        disabled={locked || unsupported || unavailableTool}
        hasAttachments={files.attachments.length > 0}

        tools={
          <>
            <ComposerMenu
              disabled={uploadLocked}
              selectedModelId={models[0]?.id ?? ""}
              selectedTool={selectedTool}
              onToolChange={onToolChange}
              onAttach={files.enabled ? uploads.open : uploadsOmitted}
            />
            <ActiveTool
              selectedTool={selectedTool}
              disabled={uploadLocked}
              onClear={() => {
                onToolChange(null);
              }}
            />
            <fieldset className="min-w-0" disabled={uploadLocked}>
              {modelPicker ?? <EveModelPicker />}
            </fieldset>
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

/** Omit capabilities for text-only chat; account callers supply their owned controls. */
export const EveComposer = ({
  capabilities,
  ...props
}: ComposerProps & {
  readonly capabilities?: ComposerCapabilities;
}): ReactJSX.Element => {
  if (capabilities) {
    return <CapableComposer {...props} {...capabilities} />;
  }
  const { modelPicker, modelIds: _modelIds, ...composer } = props;
  return (
    <fieldset className="min-w-0" aria-label="Message composer">
      <ControlledChatComposer
        {...composer}
        tools={
          <fieldset
            className="min-w-0"
            disabled={composer.disabled || composer.readOnly}
          >
            {modelPicker ?? <EveModelPicker />}
          </fieldset>
        }
      />
    </fieldset>
  );
};
