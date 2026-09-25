"use client";

import { useRef } from "react";
import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";

import { AttachmentsButton } from "@/components/attachments-button";
import { ConnectorsDropdown } from "@/components/connectors-dropdown";
import { ContextBar } from "@/components/context-bar";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import { ResponsiveTools } from "@/components/responsive-tools";
import { expandSelectedModelValue } from "@/lib/ai/types";
import type { UiToolName } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";
import { useSession } from "@/providers/session-provider";

import { EveModelPicker } from "./eve-model-picker";
import type { useEveAttachments } from "./use-eve-attachments";

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
  const input = useRef<HTMLInputElement>(null);
  const { data: session, accountsEnabled = true } = useSession();
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
  const upload = (incoming: File[]) => {
    if (!session?.user) {
      toast.error("Sign in to attach files.");
      return;
    }
    if (!uploadLocked) {
      // oxlint-disable-next-line promise/prefer-await-to-then -- Dropzone callbacks intentionally fire-and-forget uploads.
      files.upload(incoming).catch(() => null);
    }
  };
  const { getRootProps } = useDropzone({
    disabled: uploadLocked,
    noClick: true,
    noKeyboard: true,
    onDrop: upload,
  });
  return (
    <div {...getRootProps({ "aria-label": "Message composer", role: "group" })}>
      <input
        aria-label="Attach files"
        className="hidden"
        disabled={uploadLocked}
        multiple
        onChange={(event) => {
          upload([...(event.target.files ?? [])]);
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
            upload([...event.clipboardData.files]);
          }
        }}
        tools={
          <>
            {accountsEnabled && config.features.attachments && (
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
            {accountsEnabled && (
              <>
                <ConnectorsDropdown />
                <ResponsiveTools
                  disabled={locked || props.readOnly}
                  selectedModelId={models[0]?.id ?? ""}
                  setTools={onToolChange}
                  tools={selectedTool}
                />
              </>
            )}
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
};
