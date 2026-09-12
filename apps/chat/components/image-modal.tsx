"use client";

import { CopyIcon, DownloadIcon, ImageOffIcon, XIcon } from "lucide-react";
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

const handleCopyImage = async (
  e: React.MouseEvent,
  imageUrl: string | undefined
) => {
  e.stopPropagation();
  if (!imageUrl) {
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
  e: React.MouseEvent,
  imageUrl: string | undefined
) => {
  e.stopPropagation();
  if (!imageUrl) {
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

export const ImageActions = ({
  className,
  imageUrl,
}: {
  className?: string;
  imageUrl: string | undefined;
}) => (
  <div className={cn("flex items-center gap-1", className)}>
    <Button
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
      onClick={(e) => handleCopyImage(e, imageUrl)}
      size="icon-sm"
      title="Copy image"
      variant="ghost"
    >
      <CopyIcon size={16} />
      <span className="sr-only">Copy image</span>
    </Button>
    <Button
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
      onClick={(e) => handleDownload(e, imageUrl)}
      size="icon-sm"
      title="Download image"
      variant="ghost"
    >
      <DownloadIcon size={16} />
      <span className="sr-only">Download image</span>
    </Button>
  </div>
);

export const ImageModal = ({
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
          onClick={() => onClose()}
          type="button"
        >
          {imageUnavailable ? (
            <span
              className="flex flex-col items-center gap-3 text-white"
              role="status"
            >
              <ImageOffIcon className="size-10" />
              <span>Image unavailable</span>
            </span>
          ) : (
            <img
              alt={imageName ?? "Expanded image"}
              className="max-h-[90vh] max-w-[90vw] object-contain"
              onClick={(e) => e.stopPropagation()}
              onError={handleImageError}
              src={imageUrl || undefined}
            />
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
