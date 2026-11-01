"use client";

import Image from "next/image";
import React, { useMemo } from "react";

import type { JSX as ReactJSX } from "react";

import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";

export const ModelSelectorLogo = ({
  modelId,
  className,
}: {
  readonly modelId: string;
  readonly className?: string;
}): ReactJSX.Element | null => {
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
