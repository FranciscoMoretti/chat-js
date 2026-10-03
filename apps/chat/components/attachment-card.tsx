"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import {
  FileTextIcon,
  ImageOffIcon,
  Loader2Icon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import Image from "next/image";
import React from "react";

import type { AttachmentViewData } from "@/components/attachment-list";
import { Button } from "@/components/ui/button";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import { getFileImageProps } from "@/lib/file-url";
import { cn } from "@/lib/utils";
/* oxlint-enable sort-imports */

/* oxlint-disable react/forbid-component-props -- LoadingPreview: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API. */

const LoadingPreview = (): React.JSX.Element => (
  <div className="flex size-full items-center justify-center">
    <Loader2Icon className="text-muted-foreground size-5 animate-spin" />
  </div>
);
/* oxlint-enable react/forbid-component-props */
/* oxlint-disable react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- ImagePreview: react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { name, url }: { name: string; url: string }). */

const ImagePreview = ({ name, url }: { name: string; url: string }) => {
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
/* oxlint-enable react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-ternary, react/forbid-component-props, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- FilePreview: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { isPdf }: { isPdf: boolean }). */

const FilePreview = ({ isPdf }: { isPdf: boolean }): React.JSX.Element => (
  <div className="flex size-full items-center justify-center">
    {isPdf ? (
      <FileTextIcon className="size-5 text-red-500" />
    ) : (
      <PaperclipIcon className="text-muted-foreground size-5" />
    )}
  </div>
);
/* oxlint-enable no-ternary, react/forbid-component-props, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- AttachmentPreview: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

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
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- AttachmentCard: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including contentType?.startsWith("image/")); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e). */

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
/* oxlint-enable id-length, import/no-named-export, import/prefer-default-export, max-lines-per-function, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */
