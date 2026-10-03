"use client";

import { CopyIcon, DownloadIcon, ImageOffIcon, XIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import { cn } from "@/lib/utils";

interface ImageModalProps {
  imageName?: string;
  imageUrl: string;
  isOpen: boolean;
  onClose: () => void;
  showActions?: boolean;
}
/* oxlint-disable id-length, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- handleCopyImage: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e: React.MouseEvent). */

const handleCopyImage = async (
  e: React.MouseEvent,
  imageUrl: string | undefined
) => {
  e.stopPropagation();
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
/* oxlint-enable id-length, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable id-length, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- handleDownload: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e: React.MouseEvent). */

const handleDownload = async (
  e: React.MouseEvent,
  imageUrl: string | undefined
) => {
  e.stopPropagation();
  if (!(typeof imageUrl === "string" && imageUrl !== "")) {
    return;
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `image-${Date.now()}.png`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download image");
  }
};
/* oxlint-enable id-length, max-statements, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable id-length, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types -- ImageActions: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e). */

const ImageActions = ({
  className,
  imageUrl,
}: {
  className?: string;
  imageUrl: string | undefined;
}): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)}>
    <Button
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"

      onClick={(e) => {
        void handleCopyImage(e, imageUrl);
      }}
      size="icon-sm"
      title="Copy image"
      variant="ghost"
    >
      <CopyIcon size={16} />
      <span className="sr-only">Copy image</span>
    </Button>
    <Button
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"

      onClick={(e) => {
        void handleDownload(e, imageUrl);
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
/* oxlint-enable id-length, react-perf/jsx-no-new-function-as-prop, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, no-undefined, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- ImageModal: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

const ImageModal = ({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  showActions = true,
}: ImageModalProps) => {
  const { handleImageError, imageUnavailable } = useImageLoadError(imageUrl);

  return (
    <Dialog onOpenChange={onClose} open={isOpen}>
      <DialogContent
        className="bg-background/50 h-screen w-screen max-w-none rounded-none border-none p-0 backdrop-blur-sm sm:max-w-none"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          {imageName ?? "Image Preview"}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {imageName ?? "Image preview"}
        </DialogDescription>
        <DialogClose className="absolute top-4 left-4 z-10 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20">
          <XIcon size={20} />
          <span className="sr-only">Close</span>
        </DialogClose>
        <button
          className="group flex h-full w-full cursor-pointer items-center justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onClose();
            }
          }}
          type="button"
        >
          {imageUnavailable ? (
            <output className="flex flex-col items-center gap-3 text-white">
              <ImageOffIcon className="size-10" />
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
          )}
        </button>
        {showActions && !imageUnavailable && (
          <ImageActions
            className="absolute top-4 right-4"
            imageUrl={imageUrl}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable max-lines-per-function, no-undefined, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
export { ImageActions, ImageModal };
