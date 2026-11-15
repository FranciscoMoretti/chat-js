"use client";
import { CopyIcon, DownloadIcon } from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const handleCopyImage = async (
  event: Readonly<Pick<React.MouseEvent, "stopPropagation">>,
  imageUrl: string | undefined
): Promise<void> => {
  event.stopPropagation();
  if (!(typeof imageUrl === "string" && imageUrl !== "")) {
    return;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Image request failed");
    }
    const blob = await response.blob();
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    toast.success("Copied image to clipboard!");
  } catch {
    toast.error("Failed to copy image to clipboard");
  }
};

const handleDownload = async (
  event: Readonly<Pick<React.MouseEvent, "stopPropagation">>,
  imageUrl: string | undefined
): Promise<void> => {
  event.stopPropagation();
  if (!(typeof imageUrl === "string" && imageUrl !== "")) {
    return;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error("Image request failed");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = `image-${Date.now()}.png`;
    document.body.append(downloadLink);
    downloadLink.click();
    downloadLink.remove();
    URL.revokeObjectURL(url);
  } catch {
    toast.error("Failed to download image");
  }
};

const ImageActions = ({
  className,
  imageUrl,
}: {
  readonly className?: string;
  readonly imageUrl: string | undefined;
}): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)}>
    <Button
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
      onClick={(event: Readonly<Pick<React.MouseEvent, "stopPropagation">>) => {
        void handleCopyImage(event, imageUrl);
      }}
      size="icon-sm"
      title="Copy image"
      variant="ghost"
    >
      <CopyIcon size={16} />
      <span className="sr-only">Copy image</span>
    </Button>
    <Button
      className="bg-black/50 text-white hover:bg-black/70 hover:text-white"
      onClick={(event: Readonly<Pick<React.MouseEvent, "stopPropagation">>) => {
        void handleDownload(event, imageUrl);
      }}
      size="icon-sm"
      title="Download image"
      variant="ghost"
    >
      <DownloadIcon size={16} />
      <span className="sr-only">Download image</span>
    </Button>
  </div>
);

export { ImageActions };
