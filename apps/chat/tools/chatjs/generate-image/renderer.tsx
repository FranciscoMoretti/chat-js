"use client";

import { ImageOffIcon } from "lucide-react";
import { useState } from "react";

import { ImageActions, ImageModal } from "@/components/image-modal";
import { useImageLoadError } from "@/hooks/use-image-load-error";
import type { ToolPartFromTool } from "@/tools/chatjs/_shared/lib/tool-part";

import type { generateImageTool } from "./tool";

type GenerateImageTool = ToolPartFromTool<typeof generateImageTool>;

export const GenerateImageRenderer = ({
  tool,
}: {
  tool: GenerateImageTool;
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const imageUrl = tool.output?.imageUrl;
  const { handleImageError, imageUnavailable } = useImageLoadError(imageUrl);

  if (tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating image: &quot;{tool.input.prompt}&quot;
        </div>
      </div>
    );
  }
  const { output } = tool;
  if (!output) {
    return null;
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
        <div className="group relative">
          {imageUnavailable ? (
            <output className="bg-muted/30 text-muted-foreground flex min-h-64 w-full flex-col items-center justify-center gap-2">
              <ImageOffIcon className="size-8" />
              <span>Generated image unavailable</span>
            </output>
          ) : (
            <>
              <button
                className="w-full cursor-pointer text-left"
                onClick={() => setDialogOpen(true)}
                type="button"
              >
                {/* Generated media uses original URLs and the shared image error handler. */}
                {/* oxlint-disable-next-line next/no-img-element */}
                <img
                  alt={output.prompt}
                  className="h-auto w-full max-w-full"
                  height={512}
                  onError={handleImageError}
                  src={output.imageUrl}
                  width={512}
                />
              </button>
              <ImageActions
                className="absolute top-2 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
                imageUrl={output.imageUrl}
              />
            </>
          )}
        </div>
        <div className="p-4 pt-0">
          <p className="text-muted-foreground text-sm">
            Generated from: &quot;{output.prompt}&quot;
          </p>
        </div>
      </div>

      <ImageModal
        imageName={output.prompt}
        imageUrl={output.imageUrl}
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
};
