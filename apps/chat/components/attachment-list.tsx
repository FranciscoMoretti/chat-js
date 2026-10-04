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
import { toast } from "sonner";

import {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
} from "@/components/ai-elements/prompt-input";
import { AttachmentCard } from "@/components/attachment-card";
import { Button } from "@/components/ui/button";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import { getFileImageProps } from "@/lib/file-url";
/* oxlint-disable import/max-dependencies -- @/lib/utils import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { cn } from "@/lib/utils";
/* oxlint-enable import/max-dependencies */

const emptyUploadQueue: string[] = [];

interface AttachmentViewData {
  contentType: string;
  name: string;
  url: string;
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- AttachmentIcon: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- AttachmentPill: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

const AttachmentPill = ({
  attachment,
  isUploading,
  onRemove,
}: {
  attachment: AttachmentViewData;
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
            onClick={(event) => {
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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-void-return -- AttachmentItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 404); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

const AttachmentItem = ({
  attachment,
  isUploading = false,
  onRemove,
  onImageClick,
  variant = "card",
}: {
  attachment: AttachmentViewData;
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
          aria-label={attachmentLabel}
          className="inline-block cursor-default text-left"
          onClick={(event) => {
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
              onClick={(event) => {
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

              // oxlint-disable-next-line typescript/no-misused-promises -- #585: Attachment preview owns asynchronous loading and fallback display; preserve its event cancellation and preview lifecycle.
              onClick={async (event) => {
                event.stopPropagation();
                /* oxlint-disable react/todo -- Preserve attachment preview fallback handling. */
                try {
                  const response = await fetch(url);
                  if (response.status === 404) {
                    toast.error("File unavailable");
                    return;
                  }
                  if (!response.ok) {
                    // oxlint-disable-next-line react/todo -- Preserve the explicit download failure for fallback handling.
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
                /* oxlint-enable react/todo */
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
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-void-return */

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- AttachmentList: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including attachment: AttachmentViewData); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const AttachmentList = ({
  attachments,
  uploadQueue = emptyUploadQueue,
  onRemoveAction,
  onImageClick,
  variant = "card",
  testId = "attachments",
  className,
}: {
  attachments: AttachmentViewData[];
  uploadQueue?: string[];
  onRemoveAction?: (attachment: AttachmentViewData) => void;
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
      {attachments.map((attachment): React.JSX.Element => (
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

      {uploadQueue.map((filename, index): React.JSX.Element => (
        <AttachmentItem
          attachment={{
            contentType: "",
            name: filename,
            url: "",
          }}
          isUploading
          // oxlint-disable-next-line react/no-array-index-key -- The queue is an immutable batch until it is cleared; positions disambiguate same-named files.
          key={`${filename}:${index}`}
          variant={variant}
        />
      ))}
    </div>
  );
};
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-lines -- attachment-list keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
export { AttachmentList };
export type { AttachmentViewData };
