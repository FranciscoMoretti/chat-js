"use client";

import { ImageOffIcon } from "lucide-react";
import { useState } from "react";
import { ImageActions, ImageModal } from "@/components/ui/image-modal";
import type { TypelessToolPartFromTool } from "@/tools/chatjs/_shared/lib/tool-part";
import type { generateImage } from "./tool";

type GenerateImageRendererTool = TypelessToolPartFromTool<
  ReturnType<typeof generateImage.createTool>
>;

export function GenerateImageRenderer({
  tool,
}: {
  tool: GenerateImageRendererTool;
  messageId: string;
  isReadonly: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const imageUrl = tool.output?.imageUrl;
  const imageUnavailable = Boolean(imageUrl && failedImageUrl === imageUrl);

  if (tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="h-64 w-full animate-pulse rounded-lg bg-muted-foreground/20" />
        <div className="text-muted-foreground">
          Generating image: &quot;{tool.input.prompt}&quot;
        </div>
      </div>
    );
  }
  const output = tool.output;
  if (!output) {
    return (
      <div className="rounded-lg border p-4 text-muted-foreground text-sm">
        Couldn&apos;t generate image.
      </div>
    );
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4 overflow-hidden rounded-lg border">
        <div className="group relative">
          {imageUnavailable ? (
            <div
              className="flex min-h-64 w-full flex-col items-center justify-center gap-2 bg-muted/30 text-muted-foreground"
              role="status"
            >
              <ImageOffIcon className="size-8" />
              <span>Generated image unavailable</span>
            </div>
          ) : (
            <>
              <button
                className="w-full cursor-pointer text-left"
                onClick={() => setDialogOpen(true)}
                type="button"
              >
                {/* biome-ignore lint/performance/noImgElement lint/a11y/noNoninteractiveElementInteractions: Next/Image isn't desired for dynamic external URLs; onError handles loading failure */}
                <img
                  alt={output.prompt}
                  className="h-auto w-full max-w-full"
                  height={512}
                  onError={() => setFailedImageUrl(imageUrl ?? null)}
                  src={output.imageUrl}
                  width={512}
                />
              </button>
              <ImageActions
                className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
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
}
