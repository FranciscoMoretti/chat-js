import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface ImageEditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isInline: boolean;
  status: string;
  title: string;
}

export const ImageEditor = ({
  title,
  content,
  status,
  isInline,
}: ImageEditorProps) => (
  <div
    className={cn("flex w-full flex-row items-center justify-center", {
      "h-[calc(100dvh-60px)]": !isInline,
      "h-[200px]": isInline,
    })}
  >
    {status === "streaming" ? (
      <div className="flex flex-row items-center gap-4">
        {!isInline && (
          <div className="animate-spin">
            <Loader2 size={16} />
          </div>
        )}
        <div>Generating Image...</div>
      </div>
    ) : (
      <picture>
        <img
          alt={title}
          className={cn("h-fit w-full max-w-[800px]", {
            "p-0 md:p-20": !isInline,
          })}
          height={600}
          src={`data:image/png;base64,${content}`}
          width={800}
        />
      </picture>
    )}
  </div>
);
