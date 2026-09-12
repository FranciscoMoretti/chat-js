"use client";

import {
  FileTextIcon,
  ImageOffIcon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import type { Attachment } from "@/lib/ai/types";
import { getFileImageProps } from "@/lib/file-url";
import { cn } from "@/lib/utils";

const LoadingPreview = () => (
  <div className="flex size-full items-center justify-center">
    <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
  </div>
);

const ImagePreview = ({ name, url }: { name: string; url: string }) => {
  const { handleImageError, imageUnavailable } = useImageLoadError(url);
  if (imageUnavailable) {
    return (
      <div
        className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1"
        role="status"
      >
        <ImageOffIcon className="size-5" />
        <span className="text-[10px]">Unavailable</span>
      </div>
    );
  }

  const imageProps = getFileImageProps(url);
  return (
    <Image
      alt={name || "attachment"}
      className="object-cover"
      fill
      onError={handleImageError}
      sizes="80px"
      src={imageProps.src}
      unoptimized={imageProps.unoptimized}
    />
  );
};

const FilePreview = ({ isPdf }: { isPdf: boolean }) => (
  <div className="flex size-full items-center justify-center">
    {isPdf ? (
      <FileTextIcon className="size-5 text-red-500" />
    ) : (
      <PaperclipIcon className="text-muted-foreground size-5" />
    )}
  </div>
);

const AttachmentPreview = ({
  isUploading,
  isImage,
  isPdf,
  name,
  url,
}: {
  isUploading: boolean;
  isImage: boolean;
  isPdf: boolean;
  name: string;
  url: string;
}) => {
  if (isUploading) {
    return <LoadingPreview />;
  }
  if (isImage) {
    return <ImagePreview name={name} url={url} />;
  }
  return <FilePreview isPdf={isPdf} />;
};

export const AttachmentCard = ({
  attachment,
  isUploading,
  onRemove,
  className,
}: {
  attachment: Attachment;
  isUploading: boolean;
  onRemove?: () => void;
  className?: string;
}) => {
  const { name, url, contentType } = attachment;
  const isImage = Boolean(contentType?.startsWith("image/") && url);
  const isPdf = contentType === "application/pdf";

  return (
    <div
      className={cn(
        "group border-border bg-muted/30 relative size-20 shrink-0 overflow-hidden rounded-xl border shadow-xs select-none",
        isUploading && "opacity-60",
        className
      )}
      data-testid="input-attachment-preview"
    >
      <AttachmentPreview
        isImage={isImage}
        isPdf={isPdf}
        isUploading={isUploading}
        name={name}
        url={url}
      />

      {onRemove && !isUploading && (
        <Button
          aria-label="Remove attachment"
          className="border-border bg-background/90 supports-[backdrop-filter]:bg-background/70 absolute top-1 right-1 size-6 rounded-full border p-0 opacity-0 shadow-sm backdrop-blur transition-opacity group-hover:opacity-100 [&>svg]:size-3"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          size="icon"
          type="button"
          variant="ghost"
        >
          <XIcon />
          <span className="sr-only">Remove</span>
        </Button>
      )}
    </div>
  );
};
