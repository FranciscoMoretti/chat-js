"use client";

import { type ComponentProps, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { ControlledChatComposer } from "@/components/chat-composer";
import { ContextBar } from "@/components/context-bar";
import { AttachmentsButton } from "@/components/multimodal-input";
import { expandSelectedModelValue } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";
import { EveModelPicker } from "./eve-model-picker";
import type { useEveAttachments } from "./use-eve-attachments";

export function EveComposer({
  files,
  retainedModelId,
  retainedModelIds,
  modelSelection,
  ...props
}: Omit<
  ComponentProps<typeof ControlledChatComposer>,
  "tools" | "attachments" | "hasAttachments" | "onPaste"
> & {
  files: ReturnType<typeof useEveAttachments>;
  retainedModelId?: string;
  retainedModelIds?: string[];
  modelSelection?: ComponentProps<typeof EveModelPicker>["modelSelection"];
}) {
  const input = useRef<HTMLInputElement>(null);
  const selected = useDefaultModel();
  const { getModelById } = useChatModels();
  const models = (
    retainedModelId
      ? [retainedModelId]
      : expandSelectedModelValue(modelSelection?.value ?? selected)
  ).map(getModelById);
  const unsupported =
    !props.readOnly &&
    models.some((model) =>
      files.attachments.some((file) =>
        file.contentType === "application/pdf"
          ? !model?.input.pdf
          : !model?.input.image
      )
    );
  const locked = props.disabled || files.uploadQueue.length > 0;
  const uploadLocked = locked || props.readOnly;
  function upload(incoming: File[]) {
    if (!uploadLocked) {
      files.upload(incoming).catch(() => undefined);
    }
  }
  const { getRootProps } = useDropzone({
    onDrop: upload,
    noClick: true,
    noKeyboard: true,
    disabled: uploadLocked,
  });
  return (
    <div {...getRootProps({ role: "group", "aria-label": "Message composer" })}>
      <input
        aria-label="Attach files"
        className="hidden"
        disabled={uploadLocked}
        multiple
        onChange={(event) => {
          upload(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={input}
        type="file"
      />
      <ControlledChatComposer
        {...props}
        attachments={
          <ContextBar
            attachments={files.attachments}
            onRemoveAction={
              uploadLocked
                ? undefined
                : (attachment) => {
                    files.setAttachments((current) =>
                      current.filter((file) => file.url !== attachment.url)
                    );
                  }
            }
            uploadQueue={files.uploadQueue}
          />
        }
        disabled={locked || unsupported}
        hasAttachments={files.attachments.length > 0}
        onPaste={(event) => {
          if (event.clipboardData.files.length) {
            event.preventDefault();
            upload(Array.from(event.clipboardData.files));
          }
        }}
        tools={
          <>
            {config.features.attachments && (
              <AttachmentsButton
                acceptAll="image/jpeg,image/png,application/pdf"
                acceptFiles="application/pdf"
                acceptImages="image/jpeg,image/png"
                fileInputRef={input}
                status={uploadLocked ? "submitted" : "ready"}
              />
            )}
            <EveModelPicker
              disabled={locked || props.readOnly || !!retainedModelId}
              modelSelection={modelSelection}
              retainedModelId={retainedModelId}
              retainedModelIds={retainedModelIds}
            />
          </>
        }
      />
      {unsupported && (
        <p className="text-destructive text-sm" role="alert">
          Choose models that support all attached files.
        </p>
      )}
    </div>
  );
}
