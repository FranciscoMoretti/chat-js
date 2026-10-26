"use client";

import { Download, ExternalLink } from "lucide-react";
import React from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { AttachmentTrigger } from "@/components/ui/attachment";

import { AttachmentCard } from "@/components/attachment-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HTTP_NOT_FOUND = 404;

const emptyUploadQueue: string[] = [];

interface AttachmentViewData {
  readonly contentType: string;
  readonly name: string;
  readonly url: string;
}

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

  const card = (trigger?: React.ReactNode): ReactJSX.Element => (
    <AttachmentCard
      attachment={attachment}
      isUploading={isUploading}
      onRemove={onRemove}
      variant={variant}
    >
      {trigger}
    </AttachmentCard>
  );
  if (isUploading || !url) {
    return card();
  }
  return (
    <HoverCard>
      {card(
        <HoverCardTrigger
          render={
            <AttachmentTrigger
              aria-label={attachmentLabel}
              onClick={() => {
                if (isImage && onImageClick) {
                  onImageClick(url, name);
                }
              }}
            />
          }
        />
      )}
      <HoverCardContent className="w-auto p-2">
        <div className="flex items-center gap-2.5">
          <h4 className="min-w-0 flex-1 truncate px-0.5 text-sm leading-none font-semibold">
            {attachmentLabel}
          </h4>
          <div className="flex gap-1">
            <Button
              className="size-7"
              onClick={(event: { readonly stopPropagation: () => void }) => {
                event.stopPropagation();
                window.open(url, "_blank", "noopener");
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
                      window.open(url, "_blank", "noopener");
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
                    window.open(url, "_blank", "noopener");
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
      </HoverCardContent>
    </HoverCard>
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
