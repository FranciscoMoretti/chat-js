"use client";

import {
  Download,
  ExternalLink,
  FileTextIcon,
  ImageOffIcon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import React from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

import {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
} from "@/components/ai-elements/prompt-input";

import { AttachmentCard } from "@/components/attachment-card";
import { Button } from "@/components/ui/button";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";

import { getFileImageProps } from "@/lib/file-url";

import { useImageLoadError } from "@/hooks/use-image-load-error";

const HTTP_NOT_FOUND = 404;

const emptyUploadQueue: string[] = [];

interface AttachmentViewData {
  readonly contentType: string;
  readonly name: string;
  readonly url: string;
}

const AttachmentIcon = ({
  isImage,
  isPdf,
  url,
  name,
}: {
  readonly isImage: boolean;
  readonly isPdf: boolean;
  readonly url: string;
  readonly name: string;
}): React.JSX.Element => {
  const { handleImageError, imageUnavailable } = useImageLoadError(url);
  if (isImage) {
    if (imageUnavailable) {
      return (
        <>
          <ImageOffIcon className="text-muted-foreground size-3" />
          <span className="sr-only">Preview unavailable</span>
        </>
      );
    }
    const imageProps = getFileImageProps(url);
    return (
      <Image
        alt={name || "attachment"}
        className="size-5 object-cover"
        height={20}
        onError={handleImageError}
        src={imageProps.src}
        unoptimized={imageProps.unoptimized}
        width={20}
      />
    );
  }

  if (isPdf) {
    return <FileTextIcon className="size-3 text-red-500" />;
  }

  return <PaperclipIcon className="text-muted-foreground size-3" />;
};

const AttachmentPill = ({
  attachment,
  isUploading,
  onRemove,
}: {
  readonly attachment: AttachmentViewData;
  readonly isUploading: boolean;
  readonly onRemove?: () => void;
}): ReactJSX.Element => {
  const { name, url, contentType } = attachment;
  const isImage = Boolean(contentType?.startsWith("image/") && url);
  const isPdf = contentType === "application/pdf";
  const attachmentLabel = name || (isImage ? "Image" : "Attachment");

  return (
    <div
      className={cn(
        "group border-border hover:bg-accent hover:text-accent-foreground relative flex h-8 cursor-default items-center gap-1.5 rounded-md border px-1.5 text-sm font-medium transition-all select-none",
        isUploading && "opacity-60"
      )}
      data-testid="input-attachment-preview"
    >
      <div className="relative size-5 shrink-0">
        <div
          className={cn(
            "bg-background absolute inset-0 flex size-5 items-center justify-center overflow-hidden rounded transition-opacity",
            onRemove && !isUploading && "group-hover:opacity-0"
          )}
        >
          {isUploading ? (
            <Loader2Icon
              className="text-muted-foreground size-3 animate-spin"
              data-testid="input-attachment-loader"
            />
          ) : (
            <AttachmentIcon
              isImage={isImage}
              isPdf={isPdf}
              name={name}
              url={url}
            />
          )}
        </div>
        {onRemove && !isUploading && (
          <Button
            aria-label="Remove attachment"
            className="absolute inset-0 size-5 cursor-pointer rounded p-0 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 [&>svg]:size-2.5"
            onClick={(event: { readonly stopPropagation: () => void }) => {
              event.stopPropagation();
              onRemove();
            }}
            type="button"
            variant="ghost"
          >
            <XIcon />
            <span className="sr-only">Remove</span>
          </Button>
        )}
      </div>

      <span className="max-w-24 flex-1 truncate">{attachmentLabel}</span>
    </div>
  );
};

const AttachmentItem = ({
  attachment,
  isUploading = false,
  onRemove,
  onImageClick,
  variant = "card",
}: {
  readonly attachment: AttachmentViewData;
  readonly isUploading?: boolean;
  readonly onRemove?: () => void;
  readonly onImageClick?: (imageUrl: string, imageName?: string) => void;
  readonly variant?: "card" | "pill";
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const { name, url, contentType } = attachment;
  const isImage = Boolean(contentType?.startsWith("image/") && url);
  const attachmentLabel = name || (isImage ? "Image" : "Attachment");

  const preview =
    variant === "pill" ? (
      <AttachmentPill
        attachment={attachment}
        isUploading={isUploading}
        onRemove={onRemove}
      />
    ) : (
      <AttachmentCard
        attachment={attachment}
        isUploading={isUploading}
        onRemove={onRemove}
      />
    );

  // For uploading items or items without URL, just return the preview
  if (isUploading || !url) {
    return preview;
  }

  return (
    <PromptInputHoverCard>
      <HoverCardTrigger asChild>
        <button
          aria-label={attachmentLabel}
          className="inline-block cursor-default text-left"
          onClick={(event: { readonly stopPropagation: () => void }) => {
            event.stopPropagation();
            if (isImage && onImageClick) {
              onImageClick(url, name);
            }
          }}
          type="button"
        >
          {preview}
        </button>
      </HoverCardTrigger>
      <PromptInputHoverCardContent className="w-auto p-2">
        <div className="flex items-center gap-2.5">
          <h4 className="min-w-0 flex-1 truncate px-0.5 text-sm leading-none font-semibold">
            {attachmentLabel}
          </h4>
          <div className="flex gap-1">
            <Button
              className="size-7"
              onClick={(event: { readonly stopPropagation: () => void }) => {
                event.stopPropagation();
                window.open(url, "_blank");
              }}
              size="icon"
              title="Open"
              variant="ghost"
            >
              <ExternalLink className="size-3.5" />
            </Button>
            <Button
              className="size-7"

              onClick={(event: { readonly stopPropagation: () => void }) => {
                startEventAction(async () => {
                  event.stopPropagation();

                  try {
                    const response = await fetch(url);
                    if (response.status === HTTP_NOT_FOUND) {
                      toast.error("File unavailable");
                      return;
                    }
                    if (!response.ok) {
                      window.open(url, "_blank");
                      return;
                    }
                    const blob = await response.blob();
                    const blobUrl = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = blobUrl;
                    link.download = name || "file";
                    link.click();
                    URL.revokeObjectURL(blobUrl);
                  } catch {
                    // Fallback: open in new tab if fetch fails
                    window.open(url, "_blank");
                  }
                });
              }}
              size="icon"
              title="Download"
              variant="ghost"
            >
              <Download className="size-3.5" />
            </Button>
          </div>
        </div>
      </PromptInputHoverCardContent>
    </PromptInputHoverCard>
  );
};

const AttachmentList = ({
  attachments,
  uploadQueue = emptyUploadQueue,
  onRemoveAction,
  onImageClick,
  variant = "card",
  testId = "attachments",
  className,
}: {
  readonly attachments: readonly AttachmentViewData[];
  readonly uploadQueue?: readonly string[];
  readonly onRemoveAction?: (attachment: AttachmentViewData) => void;
  readonly onImageClick?: (imageUrl: string, imageName?: string) => void;
  readonly variant?: "card" | "pill";
  readonly testId?: string;
  readonly className?: string;
}): ReactJSX.Element | null => {
  if (attachments.length === 0 && uploadQueue.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex flex-row flex-wrap items-end gap-2", className)}
      data-testid={testId}
    >
      {attachments.map((attachment: AttachmentViewData): React.JSX.Element => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.url}
          onImageClick={onImageClick}
          onRemove={
            onRemoveAction
              ? () => {
                  onRemoveAction(attachment);
                }
              : undefined
          }
          variant={variant}
        />
      ))}

      {uploadQueue.map((filename, index): React.JSX.Element => (
        <AttachmentItem
          attachment={{
            contentType: "",
            name: filename,
            url: "",
          }}
          isUploading
          key={`${filename}:${index}`}
          variant={variant}
        />
      ))}
    </div>
  );
};

export { AttachmentList };
export type { AttachmentViewData };
