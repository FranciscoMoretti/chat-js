"use client";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CameraIcon, FileIcon, ImageIcon, PlusIcon } from "lucide-react";
import type React from "react";
import {
  type ChangeEvent,
  createContext,
  memo,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputButton,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { ContextBar } from "@/components/context-bar";
import { ContextUsageFromParent } from "@/components/context-usage";
import { useArtifact } from "@/hooks/use-artifact";
import { useIsMobile } from "@/hooks/use-mobile";
import type { AppModelId } from "@/lib/ai/app-model-id";
import {
  type Attachment,
  type ChatMessage,
  expandSelectedModelValue,
  type SelectedModelValue,
} from "@/lib/ai/types";
import { useCurrentChatRoute } from "@/lib/chat-route";
import { config } from "@/lib/config";
import { buildDraftChatSubmission } from "@/lib/draft-chat-submission";
import { processFilesForUpload } from "@/lib/files/upload-prep";
import { runParallelThreadRequestSpecs } from "@/lib/parallel-chat-requests";
import { useStartProvisionalChat } from "@/lib/start-provisional-chat";
import {
  clearResponseActiveStream,
  isPendingResponseStream,
} from "@/lib/stop-response";
import { useChatActions } from "@/lib/stores/base";
import {
  useApplicationThread,
  useCustomChatStoreApi,
} from "@/lib/stores/custom-store-provider";
import {
  useLastMessageId,
  useLastMessageMetadata,
} from "@/lib/stores/hooks-base";
import { ANONYMOUS_LIMITS } from "@/lib/types/anonymous";
import { cn } from "@/lib/utils";
import { useChatInput } from "@/providers/chat-input-provider";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { useTRPC } from "@/trpc/react";
import { LexicalChatInput } from "./lexical-chat-input";
import { ModelSelector } from "./model-selector";
import { getResponseAwareStatus } from "./parallel-response-status";
import { ResponsiveTools } from "./responsive-tools";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import { LimitDisplay } from "./upgrade-cta/limit-display";
import { LoginPrompt } from "./upgrade-cta/login-prompt";

/** Derive accept string for images only */
function getAcceptImages(acceptedTypes: Record<string, string[]>): string {
  return Object.entries(acceptedTypes)
    .filter(([mime]) => mime.startsWith("image/"))
    .flatMap(([, exts]) => exts)
    .join(",");
}

/** Derive accept string for non-image files only */
function getAcceptFiles(acceptedTypes: Record<string, string[]>): string {
  return Object.entries(acceptedTypes)
    .filter(([mime]) => !mime.startsWith("image/"))
    .flatMap(([, exts]) => exts)
    .join(",");
}

/** Derive accept string for all file types */
function getAcceptAll(acceptedTypes: Record<string, string[]>): string {
  return Object.values(acceptedTypes).flat().join(",");
}

function PureMultimodalInput({
  children,
  chatId,
  status,
  className,
  autoFocus = false,
  isEditMode = false,
  parentMessageId,
  onSendMessage,
}: {
  children: ReactNode;
  chatId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
  autoFocus?: boolean;
  isEditMode?: boolean;
  parentMessageId: string | null;
  onSendMessage?: (message: ChatMessage) => void | Promise<void>;
}) {
  const thread = useApplicationThread();
  const storeApi = useCustomChatStoreApi<ChatMessage>();
  const { artifact, closeArtifact } = useArtifact();
  const { data: session } = useSession();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const currentRoute = useCurrentChatRoute();
  const startProvisionalChat = useStartProvisionalChat(chatId);
  const { startRun, stop: stopHelper } = useChatActions<ChatMessage>();
  const lastMessageId = useLastMessageId();
  const lastMessageMetadata = useLastMessageMetadata();
  const responseAwareStatus = getResponseAwareStatus(
    status,
    lastMessageMetadata ? { metadata: lastMessageMetadata } : null
  );
  const {
    editorRef,
    selectedTool,
    attachments,
    setAttachments,
    selectedModelId,
    selectedModelSelection,
    handleModelChange,
    getInputValue,
    isEmpty,
    handleSubmit,
  } = useChatInput();

  const isAnonymous = !session?.user;
  const isModelDisallowedForAnonymous =
    isAnonymous &&
    !(ANONYMOUS_LIMITS.AVAILABLE_MODELS as readonly AppModelId[]).includes(
      selectedModelId
    );
  const { getModelById } = useChatModels();
  const stopStreamMutation = useMutation(
    trpc.chat.stopStream.mutationOptions()
  );
  const normalizedSelectedModel = useMemo<SelectedModelValue>(() => {
    const expanded = expandSelectedModelValue(selectedModelSelection);

    return expanded.length > 1 ? selectedModelSelection : selectedModelId;
  }, [selectedModelId, selectedModelSelection]);
  const requestedModelIds = useMemo(
    () => expandSelectedModelValue(normalizedSelectedModel),
    [normalizedSelectedModel]
  );
  const parallelResponsesEnabled = config.features.parallelResponses;
  const isParallelModelRequest =
    parallelResponsesEnabled && requestedModelIds.length > 1;

  // Attachment configuration from site config
  const { maxBytes, maxDimension, acceptedTypes } = config.attachments;
  const maxMB = Math.round(maxBytes / (1024 * 1024));
  const attachmentsEnabled = config.features.attachments;
  const acceptImages = useMemo(
    () => getAcceptImages(acceptedTypes),
    [acceptedTypes]
  );
  const acceptFiles = useMemo(
    () => getAcceptFiles(acceptedTypes),
    [acceptedTypes]
  );
  const acceptAll = useMemo(() => getAcceptAll(acceptedTypes), [acceptedTypes]);

  // Helper function to auto-switch to PDF-compatible model
  const switchToPdfCompatibleModel = useCallback(() => {
    const pdfModel = config.ai.workflows.pdf;
    const defaultPdfModelDef = getModelById(pdfModel);
    if (defaultPdfModelDef) {
      toast.success(`Switched to ${defaultPdfModelDef.name} (supports PDF)`);
    }
    handleModelChange(pdfModel);
    return defaultPdfModelDef;
  }, [handleModelChange, getModelById]);

  // Helper function to auto-switch to image-compatible model
  const switchToImageCompatibleModel = useCallback(() => {
    const imageModel = config.ai.workflows.chatImageCompatible;
    const defaultImageModelDef = getModelById(imageModel);
    if (defaultImageModelDef) {
      toast.success(
        `Switched to ${defaultImageModelDef.name} (supports images)`
      );
    }
    handleModelChange(imageModel);
    return defaultImageModelDef;
  }, [handleModelChange, getModelById]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);

  // Centralized submission gating
  const submission = useMemo(():
    | { enabled: false; message: string }
    | { enabled: true } => {
    if (isParallelModelRequest && !session?.user) {
      return {
        enabled: false,
        message: "Log in to use multiple models",
      };
    }
    if (isParallelModelRequest && attachments.length > 0) {
      return {
        enabled: false,
        message: "Multiple models with attachments are not supported yet",
      };
    }
    if (isModelDisallowedForAnonymous) {
      return { enabled: false, message: "Log in to use this model" };
    }
    if (responseAwareStatus !== "ready" && responseAwareStatus !== "error") {
      return {
        enabled: false,
        message: "Please wait for the model to finish its response!",
      };
    }
    if (uploadQueue.length > 0) {
      return {
        enabled: false,
        message: "Please wait for files to finish uploading!",
      };
    }
    if (isEmpty) {
      return {
        enabled: false,
        message: "Please enter a message before sending!",
      };
    }
    return { enabled: true };
  }, [
    attachments.length,
    isEmpty,
    isModelDisallowedForAnonymous,
    isParallelModelRequest,
    session?.user,
    responseAwareStatus,
    uploadQueue.length,
  ]);

  // Helper function to process and validate files
  const processFiles = useCallback(
    async (files: File[]): Promise<File[]> => {
      const { processedImages, pdfFiles, stillOversized, unsupportedFiles } =
        await processFilesForUpload(files, { maxBytes, maxDimension });

      if (stillOversized.length > 0) {
        toast.error(
          `${stillOversized.length} file(s) exceed ${maxMB}MB after compression`
        );
      }
      if (unsupportedFiles.length > 0) {
        toast.error(
          `${unsupportedFiles.length} unsupported file type(s). Only images and PDFs are allowed`
        );
      }

      // Auto-switch model based on file types
      if (pdfFiles.length > 0 || processedImages.length > 0) {
        let currentModelDef = getModelById(selectedModelId);

        if (pdfFiles.length > 0 && !currentModelDef?.input?.pdf) {
          currentModelDef = switchToPdfCompatibleModel();
        }
        if (processedImages.length > 0 && !currentModelDef?.input?.image) {
          currentModelDef = switchToImageCompatibleModel();
        }
      }

      return [...processedImages, ...pdfFiles];
    },
    [
      maxBytes,
      maxDimension,
      maxMB,
      selectedModelId,
      switchToPdfCompatibleModel,
      switchToImageCompatibleModel,
      getModelById,
    ]
  );

  // Trim messages in edit mode
  const trimMessagesInEditMode = useCallback(
    (parentId: string | null) => {
      thread.setCursor(parentId);
      const selectedMessages = thread.getSnapshot().messages;
      if (
        artifact.isVisible &&
        artifact.messageId &&
        !selectedMessages.some((message) => message.id === artifact.messageId)
      ) {
        closeArtifact();
      }
    },
    [artifact.isVisible, artifact.messageId, closeArtifact, thread]
  );

  const invalidatePersistedMessages = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.chat.getChatMessages.queryKey({ chatId }),
    });
  }, [chatId, queryClient, trpc]);

  const coreSubmitLogic = useCallback(() => {
    const input = getInputValue();

    // Get the appropriate parent message ID
    const effectiveParentMessageId = isEditMode
      ? parentMessageId
      : lastMessageId;

    // In edit mode, trim messages to the parent message
    if (isEditMode) {
      trimMessagesInEditMode(parentMessageId);
    }

    const { message, requestSpecs } = buildDraftChatSubmission({
      attachments,
      input,
      normalizedSelectedModel,
      parallelResponsesEnabled,
      parentMessageId: effectiveParentMessageId,
      selectedTool,
    });

    onSendMessage?.(message);

    const primaryRequest = requestSpecs[0] ?? null;

    if (
      startProvisionalChat({
        message,
        onStarted: () => {
          if (!isMobile) {
            editorRef.current?.focus();
          }
        },
        requestSpecs,
      })
    ) {
      return;
    }

    if (primaryRequest) {
      handleModelChange(primaryRequest.modelId);

      runParallelThreadRequestSpecs({
        chatId,
        isAuthenticated: !!session?.user,
        message,
        onRunStarted: storeApi.getState().registerParallelRun,
        projectId: currentRoute.projectId,
        requestSpecs,
        startRun,
      })
        .then(async (failedRequestSpecs) => {
          if (failedRequestSpecs.length > 0) {
            toast.error("Failed to complete all parallel responses");
          }

          await invalidatePersistedMessages();
        })
        .catch(() => {
          toast.error("Failed to complete all parallel responses");
        });
    } else {
      toast.error("No model selected");
    }

    // Refocus after submit
    if (!isMobile) {
      editorRef.current?.focus();
    }
  }, [
    attachments,
    isMobile,
    chatId,
    currentRoute.projectId,
    editorRef,
    handleModelChange,
    invalidatePersistedMessages,
    getInputValue,
    isEditMode,
    lastMessageId,
    normalizedSelectedModel,
    onSendMessage,
    parentMessageId,
    parallelResponsesEnabled,
    selectedTool,
    session?.user,
    startProvisionalChat,
    startRun,
    storeApi,
    trimMessagesInEditMode,
  ]);

  const submitForm = useCallback(() => {
    handleSubmit(coreSubmitLogic, isEditMode);
  }, [handleSubmit, coreSubmitLogic, isEditMode]);

  const uploadFile = useCallback(
    async (
      file: File
    ): Promise<
      { url: string; name: string; contentType: string } | undefined
    > => {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/files/upload", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const data: { url: string; pathname: string; contentType: string } =
            await response.json();
          const { url, pathname, contentType } = data;

          return {
            url,
            name: pathname,
            contentType,
          };
        }
        const { error } = (await response.json()) as { error?: string };
        toast.error(error);
      } catch (_error) {
        toast.error("Failed to upload file, please try again!");
      }
    },
    []
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      const validFiles = await processFiles(files);

      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, processFiles, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent) => {
      if (responseAwareStatus !== "ready") {
        return;
      }

      // Skip file paste handling if blob storage is disabled
      if (!attachmentsEnabled) {
        return;
      }

      const clipboardData = event.clipboardData;
      if (!clipboardData) {
        return;
      }

      const files = Array.from(clipboardData.files);
      if (files.length === 0) {
        return;
      }

      event.preventDefault();

      // Check if user is anonymous
      if (!session?.user) {
        toast.error("Sign in to attach files from clipboard");
        return;
      }

      const validFiles = await processFiles(files);
      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);

        toast.success(
          `${successfullyUploadedAttachments.length} file(s) pasted from clipboard`
        );
      } catch (error) {
        console.error("Error uploading pasted files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    [
      setAttachments,
      processFiles,
      responseAwareStatus,
      session,
      uploadFile,
      attachmentsEnabled,
    ]
  );

  const removeAttachment = useCallback(
    (attachmentToRemove: Attachment) => {
      setAttachments((currentAttachments) =>
        currentAttachments.filter(
          (attachment) => attachment.url !== attachmentToRemove.url
        )
      );
    },
    [setAttachments]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: async (acceptedFiles) => {
      if (acceptedFiles.length === 0) {
        return;
      }

      // Check if user is anonymous
      if (!session?.user) {
        toast.error("Sign in to attach files");
        return;
      }

      const validFiles = await processFiles(acceptedFiles);
      if (validFiles.length === 0) {
        return;
      }

      setUploadQueue(validFiles.map((file) => file.name));

      try {
        const uploadPromises = validFiles.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (error) {
        console.error("Error uploading files!", error);
      } finally {
        setUploadQueue([]);
      }
    },
    noClick: true, // Prevent click to open file dialog since we have the button
    disabled: responseAwareStatus !== "ready" || !attachmentsEnabled,
    noDrag: !attachmentsEnabled,
    accept: acceptedTypes,
  });

  const handleStop = useCallback(() => {
    const isPendingResponse = isPendingResponseStream(
      lastMessageMetadata?.activeStreamId
    );
    const lastMessage = thread.getSnapshot().messages.at(-1);
    if (
      session?.user &&
      lastMessage?.role === "assistant" &&
      !isPendingResponse
    ) {
      stopStreamMutation.mutate({
        chatId,
        messageId: lastMessage.id,
        type: "message",
      });
    }
    stopHelper?.();
    if (lastMessageId) {
      if (isPendingResponse) {
        thread.removeMessage(lastMessageId);
      } else {
        thread.setMessages(
          clearResponseActiveStream(
            thread.getSnapshot().messages,
            lastMessageId
          )
        );
      }
    }
  }, [
    chatId,
    lastMessageId,
    lastMessageMetadata?.activeStreamId,
    session?.user,
    stopHelper,
    stopStreamMutation,
    thread,
  ]);

  return (
    <div className="relative">
      {attachmentsEnabled && (
        <input
          accept={acceptAll}
          className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
          multiple
          onChange={handleFileChange}
          ref={fileInputRef}
          tabIndex={-1}
          type="file"
        />
      )}

      <div className="relative">
        <PromptInput
          className={cn(
            "@container relative transition-colors",
            isDragActive && "border-primary bg-accent",
            className
          )}
          inputGroupClassName="bg-muted dark:bg-muted"
          {...getRootProps({ onError: undefined, onSubmit: undefined })}
          onSubmit={(_message, event) => {
            event.preventDefault();
            if (!submission.enabled) {
              if (submission.message) {
                toast.error(submission.message);
              }
              return;
            }
            submitForm();
          }}
        >
          <input {...getInputProps()} />

          {isDragActive && attachmentsEnabled && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-primary border-dashed bg-accent/80">
              <div className="font-medium text-primary">
                Drop images or PDFs here to attach
              </div>
            </div>
          )}

          <ComposerContext.Provider
            value={{
              autoFocus,
              isEditMode,
              isModelDisallowedForAnonymous,
              parentMessageId,
              status: responseAwareStatus,
              submission,
              submitForm,
              onStop: handleStop,
              onPaste: handlePaste,
              fileInputRef,
              acceptAll,
              acceptFiles,
              acceptImages,
              uploadQueue,
              removeAttachment,
            }}
          >
            {children}
          </ComposerContext.Provider>
        </PromptInput>
      </div>
    </div>
  );
}

function PureAttachmentsButton({
  fileInputRef,
  status,
  acceptAll,
  acceptImages,
  acceptFiles,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  acceptAll: string;
  acceptImages: string;
  acceptFiles: string;
}) {
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const triggerFileInput = useCallback(
    (accept: string, capture?: "environment" | "user") => {
      const input = fileInputRef.current;
      if (!input) {
        return;
      }
      input.accept = accept;
      if (capture) {
        input.capture = capture;
      } else {
        input.removeAttribute("capture");
      }
      input.click();
    },
    [fileInputRef]
  );

  const handleDesktopClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isAnonymous) {
      setShowLoginPopover(true);
      return;
    }
    triggerFileInput(acceptAll);
  };

  // Mobile: dropdown with separate options
  if (isMobile) {
    if (isAnonymous) {
      return (
        <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={() => setShowLoginPopover(true)}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <LoginPrompt
              description="You can attach images and PDFs to your messages for the AI to analyze."
              title="Sign in to attach files"
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PromptInputButton
            className="size-8"
            data-testid="attachments-button"
            disabled={status !== "ready"}
            variant="ghost"
          >
            <PlusIcon className="size-4" />
          </PromptInputButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => triggerFileInput(acceptImages)}>
            <ImageIcon />
            Add photos
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => triggerFileInput(acceptImages, "environment")}
          >
            <CameraIcon />
            Take photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(acceptFiles)}>
            <FileIcon />
            Add files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Desktop: single button with tooltip
  return (
    <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="@[500px]:size-10 size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={handleDesktopClick}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add Files</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <LoginPrompt
          description="You can attach images and PDFs to your messages for the AI to analyze."
          title="Sign in to attach files"
        />
      </PopoverContent>
    </Popover>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

const ComposerContext = createContext<{
  autoFocus: boolean;
  isEditMode: boolean;
  isModelDisallowedForAnonymous: boolean;
  parentMessageId: string | null;
  status: UseChatHelpers<ChatMessage>["status"];
  submission: { enabled: boolean; message?: string };
  submitForm: () => void;
  onStop: () => void;
  onPaste: (event: React.ClipboardEvent) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  acceptAll: string;
  acceptFiles: string;
  acceptImages: string;
  uploadQueue: string[];
  removeAttachment: (attachment: Attachment) => void;
} | null>(null);

function useComposer() {
  const context = useContext(ComposerContext);
  if (!context) {
    throw new Error("Place composer parts inside MultimodalInput");
  }
  return context;
}

export function ComposerLimits() {
  const { isEditMode, isModelDisallowedForAnonymous } = useComposer();
  return isEditMode ? null : (
    <LimitDisplay
      className="p-2"
      forceVariant={isModelDisallowedForAnonymous ? "model" : "credits"}
    />
  );
}

export function ComposerAttachments() {
  const { uploadQueue, removeAttachment } = useComposer();
  const { attachments } = useChatInput();
  return (
    <ContextBar
      attachments={attachments}
      className="w-full"
      onRemoveAction={removeAttachment}
      uploadQueue={uploadQueue}
    />
  );
}

export function ComposerInput() {
  const { autoFocus, submission, submitForm, onPaste } = useComposer();
  const { editorRef, getInitialInput, handleInputChange } = useChatInput();
  const isMobile = useIsMobile();
  return (
    <LexicalChatInput
      autoFocus={autoFocus}
      className="max-h-[max(35svh,5rem)] min-h-[60px] overflow-y-scroll sm:min-h-[80px]"
      data-testid="multimodal-input"
      initialValue={getInitialInput()}
      onEnterSubmit={(event) => {
        const shouldSubmit = isMobile ? event.ctrlKey : !event.shiftKey;
        if (!shouldSubmit) {
          return false;
        }
        if (!submission.enabled) {
          if (submission.message) {
            toast.error(submission.message);
          }
          return true;
        }
        submitForm();
        return true;
      }}
      onInputChange={handleInputChange}
      onPaste={onPaste}
      placeholder={
        isMobile
          ? "Send a message... (Ctrl+Enter to send)"
          : "Send a message..."
      }
      ref={editorRef}
    />
  );
}

export function ComposerAttachButton() {
  const { fileInputRef, status, acceptAll, acceptImages, acceptFiles } =
    useComposer();
  return config.features.attachments ? (
    <AttachmentsButton
      acceptAll={acceptAll}
      acceptFiles={acceptFiles}
      acceptImages={acceptImages}
      fileInputRef={fileInputRef}
      status={status}
    />
  ) : null;
}

export function ComposerModelPicker() {
  const {
    selectedModelId,
    selectedModelSelection,
    handleModelSelectionChange,
  } = useChatInput();
  return (
    <ModelSelector
      className="@[500px]:h-10 h-8 w-fit max-w-none shrink justify-start truncate @[500px]:px-3 px-2 @[500px]:text-sm text-xs"
      onModelSelectionChangeAction={handleModelSelectionChange}
      selectedModelId={selectedModelId}
      selectedModelSelection={selectedModelSelection}
    />
  );
}

export function ComposerTools() {
  const { selectedModelId, selectedTool, setSelectedTool } = useChatInput();
  return (
    <ResponsiveTools
      selectedModelId={selectedModelId}
      setTools={setSelectedTool}
      tools={selectedTool}
    />
  );
}

export function ComposerContextUsage() {
  const { parentMessageId } = useComposer();
  const { selectedModelId } = useChatInput();
  return (
    <ContextUsageFromParent
      className="@[500px]:block hidden"
      iconOnly
      parentMessageId={parentMessageId}
      selectedModelId={selectedModelId}
    />
  );
}

export function ComposerSubmit() {
  const { status, submission, submitForm, onStop } = useComposer();
  return (
    <PromptInputSubmit
      className="@[500px]:size-10 size-8 shrink-0"
      disabled={status === "ready" && !submission.enabled}
      onClick={(event) => {
        event.preventDefault();
        if (status === "streaming" || status === "submitted") {
          onStop();
        } else if (status === "ready" || status === "error") {
          if (!submission.enabled) {
            if (submission.message) {
              toast.error(submission.message);
            }
            return;
          }
          submitForm();
        }
      }}
      status={status}
    />
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.children !== nextProps.children) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (prevProps.autoFocus !== nextProps.autoFocus) {
      return false;
    }
    if (prevProps.isEditMode !== nextProps.isEditMode) {
      return false;
    }
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.className !== nextProps.className) {
      return false;
    }
    if (prevProps.parentMessageId !== nextProps.parentMessageId) {
      return false;
    }
    if (prevProps.onSendMessage !== nextProps.onSendMessage) {
      return false;
    }
    return true;
  }
);
