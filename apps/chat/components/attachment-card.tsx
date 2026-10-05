"use client";

import {
  FileTextIcon,
  ImageOffIcon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import type { JSX as ReactJSX } from "react";
import React from "react";

import type { AttachmentViewData } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import { getFileImageProps } from "@/lib/file-url";
import { cn } from "@/lib/utils";

const LoadingPreview = (): React.JSX.Element => (
  <div className="flex size-full items-center justify-center">
    <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
  </div>
);

/* oxlint-disable react/no-multi-comp -- ImagePreview: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { name, url }: { name: string; url: string }). */

const ImagePreview = ({
  name,
  url,
}: {
  readonly name: string;
  readonly url: string;
}): React.JSX.Element => {
  const { handleImageError, imageUnavailable } = useImageLoadError(url);
  if (imageUnavailable) {
    return (
      <output className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1">
        <ImageOffIcon className="size-5" />
        <span className="text-[10px]">Unavailable</span>
      </output>
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
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- FilePreview: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { isPdf }: { isPdf: boolean }). */

const FilePreview = ({
  isPdf,
}: {
  readonly isPdf: boolean;
}): React.JSX.Element => (
  <div className="flex size-full items-center justify-center">
    {isPdf ? (
      <FileTextIcon className="size-5 text-red-500" />
    ) : (
      <PaperclipIcon className="text-muted-foreground size-5" />
    )}
  </div>
);
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable react/no-multi-comp -- AttachmentPreview: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const AttachmentPreview = ({
  isUploading,
  isImage,
  isPdf,
  name,
  url,
}: {
  readonly isUploading: boolean;
  readonly isImage: boolean;
  readonly isPdf: boolean;
  readonly name: string;
  readonly url: string;
}): React.JSX.Element => {
  if (isUploading) {
    return <LoadingPreview />;
  }
  if (isImage) {
    return <ImagePreview name={name} url={url} />;
  }
  return <FilePreview isPdf={isPdf} />;
};
/* oxlint-enable react/no-multi-comp */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- AttachmentCard: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event). */

export const AttachmentCard = ({
  attachment,
  isUploading,
  onRemove,
  className,
}: {
  attachment: AttachmentViewData;
  isUploading: boolean;
  onRemove?: () => void;
  className?: string;
}): ReactJSX.Element => {
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
          onClick={(event) => {
            event.stopPropagation();
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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
