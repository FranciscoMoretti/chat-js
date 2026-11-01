"use client";

import { CopyIcon, DownloadIcon, ImageOffIcon, XIcon } from "lucide-react";
import Image from "next/image";
import React from "react";
import type { JSX as ReactJSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { cn } from "@/lib/utils";

import { useImageLoadError } from "@/hooks/use-image-load-error";

interface ImageModalProps {
  readonly imageName?: string;
  readonly imageUrl: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly showActions?: boolean;
}

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

const ImageActions = ({
  className,
  imageUrl,
}: {
  readonly className?: string;
  readonly imageUrl: string | undefined;
}): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)}>
    <Button
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
          {imageUnavailable ? (
            <output className="flex flex-col items-center gap-3 text-white">
              <ImageOffIcon className="size-10" />
              <span>Image unavailable</span>
            </output>
          ) : (
            imageUrl !== "" && (
              <Image
                alt={imageName ?? "Expanded image"}
                loading="eager"
                unoptimized
                className="h-auto max-h-[90vh] w-auto max-w-[90vw] object-contain"
                // Auto CSS sizing keeps unknown attachment dimensions intrinsic; zero hints reserve no artificial aspect ratio.
                height={0}
                width={0}
                onError={handleImageError}
                src={imageUrl}
              />
            )
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
export { ImageActions, ImageModal };
