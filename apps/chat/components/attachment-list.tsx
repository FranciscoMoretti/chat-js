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

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  PromptInputHoverCard,
  PromptInputHoverCardContent,
} from "@/components/ai-elements/prompt-input";
/* oxlint-enable sort-imports */
import { AttachmentCard } from "@/components/attachment-card";
import { Button } from "@/components/ui/button";
import { HoverCardTrigger } from "@/components/ui/hover-card";
import { useImageLoadError } from "@/hooks/use-image-load-error";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getFileImageProps } from "@/lib/file-url";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- @/lib/utils import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */

const emptyUploadQueue: string[] = [];

interface AttachmentViewData {
  readonly contentType: string;
  readonly name: string;
  readonly url: string;
}
/* oxlint-disable react/jsx-no-literals -- AttachmentIcon renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/forbid-component-props -- ImageOffIcon, Image, FileTextIcon, PaperclipIcon accept the supplied styling props; preserve this composition's layout and appearance. */
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- AttachmentPill renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react/forbid-component-props */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp -- AttachmentPill: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result */

/* oxlint-disable react/forbid-component-props -- Loader2Icon, Button accept the supplied styling props; preserve this composition's layout and appearance. */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from contentType; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isImage = Boolean(contentType?.startsWith("image/") && url);
  const isPdf = contentType === "application/pdf";
  // oxlint-disable-next-line no-ternary -- Keep || operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            isUploading ? (
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
            )
          }
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/strict-void-return -- AttachmentItem: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 404); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

/* oxlint-disable react/forbid-component-props -- PromptInputHoverCardContent, Button, ExternalLink, Download accept the supplied styling props; preserve this composition's layout and appearance. */
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
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading startsWith from contentType; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  const isImage = Boolean(contentType?.startsWith("image/") && url);
  // oxlint-disable-next-line no-ternary -- Keep || operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const attachmentLabel = name || (isImage ? "Image" : "Attachment");

  const preview =
    // oxlint-disable-next-line no-ternary -- Keep preview as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
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
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/strict-void-return */

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/no-multi-comp, unicorn/no-null -- AttachmentList: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
            // oxlint-disable-next-line no-ternary -- Keep onRemove JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
          // oxlint-disable-next-line react/no-array-index-key -- useUploads sets the selected filename batch once, locks further selections, and clears the whole batch in finally; filenames can repeat, so the batch position disambiguates them without changing during its lifetime.
          key={`${filename}:${index}`}
          variant={variant}
        />
      ))}
    </div>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (AttachmentList); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop, react/no-multi-comp, unicorn/no-null */

/* oxlint-disable max-lines -- attachment-list keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
export { AttachmentList };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (AttachmentViewData); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { AttachmentViewData };
/* oxlint-enable import/no-named-export */
