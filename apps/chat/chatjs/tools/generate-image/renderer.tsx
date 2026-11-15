"use client";
import { ImageActions } from "@/components/image-actions";
import { ArtifactViewerActions } from "@/components/artifact-actions";
import React from "react";
import { generateImageInput, generateImageResult } from "./schemas";
import Image from "next/image";
import { ImageOffIcon } from "lucide-react";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ToolRendererProps } from "@/chatjs/core/tools/define-renderer";
import { defineToolRenderer } from "@/chatjs/core/tools/define-renderer";
import { useImageLoadError } from "@/hooks/use-image-load-error";

type GenerateImageTool = ToolRendererProps<
  typeof generateImageInput,
  typeof generateImageResult
>["tool"];

const GenerateImageView = ({
  tool,
}: ReadonlyNativeSurface<{
  tool: GenerateImageTool;
}>): React.JSX.Element | null => {
  const imageUrl = tool.output?.imageUrl;
  const { handleImageError, imageUnavailable } = useImageLoadError(imageUrl);

  if (tool.state === "input-streaming" || tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating image: &quot;
          {tool.input?.prompt ?? "Preparing prompt…"}
          &quot;
        </div>
      </div>
    );
  }
  const { output } = tool;
  if (output === undefined) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
      <div className="group relative">
        {imageUnavailable ? (
          <output className="bg-muted/30 text-muted-foreground flex min-h-64 w-full flex-col items-center justify-center gap-2">
            <ImageOffIcon className="size-8" />
            <span>Generated image unavailable</span>
          </output>
        ) : (
          <>
            <Image
              alt={output.prompt}
              loading="eager"
              unoptimized
              className="h-auto w-full max-w-full"
              height={512}
              onError={handleImageError}
              src={output.imageUrl}
              width={512}
            />
            <div className="absolute top-2 right-2 flex items-center gap-1">
              <ArtifactViewerActions
                artifact={{
                  fileId: output.fileId,
                  url: output.imageUrl,
                  name: output.prompt,
                  mediaType: "image/*",
                }}
              />
              <ImageActions imageUrl={output.imageUrl} />
            </div>
          </>
        )}
      </div>
      <div className="p-4 pt-0">
        <p className="text-muted-foreground text-sm">
          Generated from: &quot;{output.prompt}&quot;
        </p>
      </div>
    </div>
  );
};

export const GenerateImageRenderer = defineToolRenderer({
  inputSchema: generateImageInput,
  outputSchema: generateImageResult,
  render: GenerateImageView,
});
