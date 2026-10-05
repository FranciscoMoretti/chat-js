"use client";

import Image from "next/image";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useMemo } from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
import { useChatModels } from "@/providers/chat-models-provider";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ModelSelectorLogo); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, unicorn/no-null -- ModelSelectorLogo: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
      // oxlint-disable-next-line react/forbid-component-props -- Image accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("size-4 brightness-0 dark:invert", className)}
      height={16}
      src={`https://models.dev/logos/${provider}.svg`}
      width={16}
    />
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-magic-numbers, unicorn/no-null */
