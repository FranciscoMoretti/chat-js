"use client";

import { ImageOffIcon } from "lucide-react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { useState } from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ImageActions, ImageModal } from "@/components/image-modal";
/* oxlint-enable sort-imports */
import { useImageLoadError } from "@/hooks/use-image-load-error";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ToolRendererProps } from "@/lib/ai/define-tool-renderer";
/* oxlint-enable sort-imports */
import { defineToolRenderer } from "@/lib/ai/define-tool-renderer";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { generateImageInput, generateImageResult } from "./schemas";
/* oxlint-enable sort-imports */

type GenerateImageTool = ToolRendererProps<
  typeof generateImageInput,
  typeof generateImageResult
>["tool"];
/* oxlint-disable react/jsx-no-literals -- GenerateImageView renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/only-export-components -- Registry consumers require the colocated render helper or metadata exports; the published module is not solely a Fast Refresh boundary. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const GenerateImageView = ({ tool }: { tool: GenerateImageTool }) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const imageUrl = tool.output?.imageUrl;
  const { handleImageError, imageUnavailable } = useImageLoadError(imageUrl);

  if (tool.state === "input-streaming" || tool.state === "input-available") {
    return (
      <div className="flex w-full flex-col items-center justify-center gap-4 rounded-lg border p-8">
        <div className="bg-muted-foreground/20 h-64 w-full animate-pulse rounded-lg" />
        <div className="text-muted-foreground">
          Generating image: &quot;{tool.input?.prompt ?? "Preparing prompt…"}
          &quot;
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
              <ImageOffIcon
                // oxlint-disable-next-line react/forbid-component-props -- ImageOffIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                className="size-8"
              />
              <span>Generated image unavailable</span>
            </output>
          ) : (
            <>
              <button
                className="w-full cursor-pointer text-left"
                onClick={(): void => setDialogOpen(true)}
                type="button"
              >
                {/* oxlint-disable-next-line next/no-img-element -- Review debt #623: preserve provider URLs and the shared image-error fallback until Next/Image provider handling is verified. */}
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
                // oxlint-disable-next-line react/forbid-component-props -- ImageActions accepts className in its styling contract; preserve this caller's layout and appearance.
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
        onClose={(): void => setDialogOpen(false)}
      />
    </>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable unicorn/no-null */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable react/only-export-components */

export const GenerateImageRenderer = defineToolRenderer({
  inputSchema: generateImageInput,
  outputSchema: generateImageResult,
  render: GenerateImageView,
});
