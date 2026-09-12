"use client";
import Image from "next/image";
import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";

export const ModelSelectorLogo = ({
  modelId,
  className,
}: {
  modelId: string;
  className?: string;
}) => {
  const { getModelById } = useChatModels();
  const provider = useMemo(() => {
    const model = getModelById(modelId);
    return model?.owned_by ?? modelId.split("/")[0] ?? "";
  }, [getModelById, modelId]);

  if (!provider) {
    return null;
  }

  return (
    <Image
      alt={`${provider} logo`}
      className={cn("size-4 brightness-0 dark:invert", className)}
      height={16}
      src={`https://models.dev/logos/${provider}.svg`}
      width={16}
    />
  );
};
