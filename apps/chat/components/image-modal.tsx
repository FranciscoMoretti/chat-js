"use client";

import { CopyIcon, DownloadIcon, ImageOffIcon, XIcon } from "lucide-react";
import React from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */
import { useImageLoadError } from "@/hooks/use-image-load-error";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

interface ImageModalProps {
  readonly imageName?: string;
  readonly imageUrl: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly showActions?: boolean;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleCopyImage's awaited sequencing and rejected-Promise behavior. */
const handleCopyImage = async (
  event: Readonly<Pick<React.MouseEvent, "stopPropagation">>,
  imageUrl: string | undefined
): Promise<void> => {
  event.stopPropagation();
  if (!(typeof imageUrl === "string" && imageUrl !== "")) {
    return;
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    toast.success("Copied image to clipboard!");
  } catch {
    toast.error("Failed to copy image to clipboard");
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleDownload's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements -- handleDownload: max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation. */

const handleDownload = async (
  event: Readonly<Pick<React.MouseEvent, "stopPropagation">>,
  imageUrl: string | undefined
): Promise<void> => {
  event.stopPropagation();
  if (!(typeof imageUrl === "string" && imageUrl !== "")) {
    return;
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `image-${Date.now()}.png`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download image");
  }
};
/* oxlint-disable react/jsx-no-literals -- ImageActions renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- ImageActions: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract;  */

const ImageActions = ({
  className,
  imageUrl,
}: {
  readonly className?: string;
  readonly imageUrl: string | undefined;
}): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)}>
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"

      onClick={(event: Readonly<Pick<React.MouseEvent, "stopPropagation">>) => {
        void handleCopyImage(event, imageUrl);
      }}
      size="icon-sm"
      title="Copy image"
      variant="ghost"
    >
      <CopyIcon size={16} />
      <span className="sr-only">Copy image</span>
    </Button>
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"

      onClick={(event: Readonly<Pick<React.MouseEvent, "stopPropagation">>) => {
        void handleDownload(event, imageUrl);
      }}
      size="icon-sm"
      title="Download image"
      variant="ghost"
    >
      <DownloadIcon size={16} />
      <span className="sr-only">Download image</span>
    </Button>
  </div>
);
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- ImageModal renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-disable max-lines-per-function, no-undefined, react/jsx-max-depth, react/no-multi-comp -- ImageModal: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships;  */

const ImageModal = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  showActions = true,
}: ImageModalProps): ReactJSX.Element => {
  const { handleImageError, imageUnavailable } = useImageLoadError(imageUrl);

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent
        // oxlint-disable-next-line react/forbid-component-props -- DialogContent accepts className in its styling contract; preserve this caller's layout and appearance.
        className="bg-background/50 h-screen w-screen max-w-none rounded-none border-none p-0 backdrop-blur-sm sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle
          // oxlint-disable-next-line react/forbid-component-props -- DialogTitle accepts className in its styling contract; preserve this caller's layout and appearance.
          className="sr-only"
        >
          {imageName ?? "Image Preview"}
        </DialogTitle>
        <DialogDescription
          // oxlint-disable-next-line react/forbid-component-props -- DialogDescription accepts className in its styling contract; preserve this caller's layout and appearance.
          className="sr-only"
        >
          {imageName ?? "Image preview"}
        </DialogDescription>
        <DialogClose
          // oxlint-disable-next-line react/forbid-component-props -- DialogClose accepts className in its styling contract; preserve this caller's layout and appearance.
          className="absolute top-4 left-4 z-10 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <XIcon size={20} />
          <span className="sr-only">Close</span>
        </DialogClose>
        <button
          className="group flex h-full w-full cursor-pointer items-center justify-center"
          onClick={(event: {
            readonly target: object;
            readonly currentTarget: object;
          }) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          type="button"
        >
          {
            // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            imageUnavailable ? (
              <output className="flex flex-col items-center gap-3 text-white">
                <ImageOffIcon
                  // oxlint-disable-next-line react/forbid-component-props -- ImageOffIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                  className="size-10"
                />
                <span>Image unavailable</span>
              </output>
            ) : (
              <>
                {/* oxlint-disable-next-line next/no-img-element -- Expanded images use arbitrary attachment URLs. */}
                <img
                  alt={imageName ?? "Expanded image"}
                  className="max-h-[90vh] max-w-[90vw] object-contain"
                  onError={handleImageError}
                  src={imageUrl || undefined}
                />
              </>
            )
          }
        </button>
        {showActions && !imageUnavailable && (
          <ImageActions
            // oxlint-disable-next-line react/forbid-component-props -- ImageActions accepts className in its styling contract; preserve this caller's layout and appearance.
            className="absolute top-4 right-4"
            imageUrl={imageUrl}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ImageActions, ImageModal); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-undefined, react/jsx-max-depth, react/no-multi-comp */
export { ImageActions, ImageModal };
/* oxlint-enable import/no-named-export */
