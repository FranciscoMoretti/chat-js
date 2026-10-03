"use client";

import Image from "next/image";
import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";
/* oxlint-disable no-magic-numbers, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- ModelSelectorLogo: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable no-magic-numbers, react/forbid-component-props, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
