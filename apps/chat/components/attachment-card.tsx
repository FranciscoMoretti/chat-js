"use client";

import { FileTextIcon, ImageOffIcon, PaperclipIcon, XIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";
import type { AttachmentViewData } from "@/components/attachment-list";
import {
  Attachment,
  AttachmentContent,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentAction,
  AttachmentActions,
} from "@/components/ui/attachment";
import { AttachmentCardView } from "./attachment-card-view";
import { Spinner } from "@/components/ui/spinner";
import { getFileImageProps } from "@/lib/file-url";
import { useImageLoadError } from "@/hooks/use-image-load-error";

export const AttachmentCard = ({
  attachment,
  isUploading,
  onRemove,
  variant = "card",
  children,
}: {
  readonly attachment: AttachmentViewData;
  readonly isUploading: boolean;
  readonly onRemove?: () => void;
  readonly variant?: "card" | "pill";
  readonly children?: ReactNode;
}) => {
  const { name, url, contentType } = attachment;
  const isImage = contentType.startsWith("image/") && Boolean(url);
  const { handleImageError, imageUnavailable } = useImageLoadError(url);
  const imageProps = getFileImageProps(url);
  let media: ReactNode = <PaperclipIcon />;
  if (isUploading) {
    media = <Spinner data-testid="input-attachment-loader" />;
  } else if (isImage && imageUnavailable) {
    media = (
      <>
        <ImageOffIcon />
        <span className="sr-only">Preview unavailable</span>
      </>
    );
  } else if (isImage) {
    media = (
      <Image
        alt={name || "Attachment"}
        height={96}
        width={96}
        onError={handleImageError}
        src={imageProps.src}
        unoptimized={imageProps.unoptimized}
      />
    );
  } else if (contentType === "application/pdf") {
    media = <FileTextIcon />;
  }
  return (
    <AttachmentCardView
      primitives={{
        Attachment,
        AttachmentContent,
        AttachmentMedia,
        AttachmentTitle,
      }}
      title={name || (isImage ? "Image" : "Attachment")}
      media={media}
      mediaVariant={isImage && !imageUnavailable ? "image" : "icon"}
      variant={variant}
      state={isUploading ? "uploading" : "done"}
      actions={
        onRemove &&
        !isUploading && (
          <AttachmentActions>
            <AttachmentAction
              aria-label="Remove attachment"
              onClick={onRemove}
              type="button"
            >
              <XIcon />
            </AttachmentAction>
          </AttachmentActions>
        )
      }
    >
      {children}
    </AttachmentCardView>
  );
};
