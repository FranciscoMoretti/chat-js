"use client";

import { ImageOffIcon, XIcon } from "lucide-react";
import Image from "next/image";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { ImageActions } from "@/components/image-actions";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

import { useImageLoadError } from "@/hooks/use-image-load-error";

interface ImageModalProps {
  readonly imageName?: string;
  readonly imageUrl: string;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly showActions?: boolean;
}

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
export { ImageModal };
