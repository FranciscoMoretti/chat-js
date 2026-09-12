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
import { toast } from "sonner";

import {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
} from "@/components/ai-elements/prompt-input";
import { AttachmentCard } from "@/components/attachment-card";
import { Button } from "@/components/ui/button";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import type { Attachment } from "@/lib/ai/types";
import { getFileImageProps } from "@/lib/file-url";
import { cn } from "@/lib/utils";

const AttachmentIcon = ({
  isImage,
  isPdf,
  url,
  name,
}: {
  isImage: boolean;
  isPdf: boolean;
  url: string;
  name: string;
}) => {
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
  attachment: Attachment;
  isUploading: boolean;
  onRemove?: () => void;
}) => {
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
            onClick={(e) => {
              e.stopPropagation();
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
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
  onImageClick?: (imageUrl: string, imageName?: string) => void;
  variant?: "card" | "pill";
}) => {
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
          className="inline-block cursor-default text-left"
          onClick={(e) => {
            e.stopPropagation();
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
              onClick={(e) => {
                e.stopPropagation();
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
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const response = await fetch(url);
                  if (response.status === 404) {
                    toast.error("File unavailable");
                    return;
                  }
                  if (!response.ok) {
                    throw new Error(
                      `File download failed (${response.status})`
                    );
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

export const AttachmentList = ({
  attachments,
  uploadQueue = [],
  onRemoveAction,
  onImageClick,
  variant = "card",
  testId = "attachments",
  className,
}: {
  attachments: Attachment[];
  uploadQueue?: string[];
  onRemoveAction?: (attachment: Attachment) => void;
  onImageClick?: (imageUrl: string, imageName?: string) => void;
  variant?: "card" | "pill";
  testId?: string;
  className?: string;
}) => {
  if (attachments.length === 0 && uploadQueue.length === 0) {
    return null;
  }

  return (
    <div
      className={cn("flex flex-row flex-wrap items-end gap-2", className)}
      data-testid={testId}
    >
      {attachments.map((attachment) => (
        <AttachmentItem
          attachment={attachment}
          key={attachment.url}
          onImageClick={onImageClick}
          onRemove={
            onRemoveAction ? () => onRemoveAction(attachment) : undefined
          }
          variant={variant}
        />
      ))}

      {uploadQueue.map((filename) => (
        <AttachmentItem
          attachment={{
            contentType: "",
            name: filename,
            url: "",
          }}
          isUploading={true}
          key={filename}
          variant={variant}
        />
      ))}
    </div>
  );
};
