"use client";

import React from "react";
import type { JSX as ReactJSX } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ModelSelector } from "@/components/model-selector";
/* oxlint-enable sort-imports */
import type { SelectedModelValue } from "@/lib/ai/types";
import { getPrimarySelectedModelId } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveModelPicker); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveModelPicker renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */
/* oxlint-disable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions, typescript/strict-void-return -- EveModelPicker: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including retainedModelId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

export const EveModelPicker = ({
  disabled = false,
  retainedModelId,
  retainedModelIds,
  modelSelection,
}: {
  readonly disabled?: boolean;
  readonly retainedModelId?: string;
  readonly retainedModelIds?: readonly string[];
  readonly modelSelection?: {
    readonly value: SelectedModelValue;
    readonly onChange: (value: SelectedModelValue) => Promise<void>;
  };
}): ReactJSX.Element => {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const { getModelById } = useChatModels();
  if (retainedModelIds) {
    const names = retainedModelIds
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading name from getModelById(...); preserve one receiver evaluation, skipped accesses and the existing id fallback. The app guidance prefers optional chaining.
      .map((id) => getModelById(id)?.name ?? id)
      .join(", ");
    return (
      <span className="inline-flex h-8 items-center px-2 text-sm" title={names}>
        {retainedModelIds.length} models
      </span>
    );
  }
  const selectedModel =
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing, oxc/no-optional-chaining -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. Optional chain: Keep the existing nullish guard when reading id from getModelById(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    (retainedModelId && getModelById(retainedModelId)?.id) ||
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing, oxc/no-optional-chaining -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. Optional chain: Keep the existing nullish guard when reading value from modelSelection; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    getPrimarySelectedModelId(modelSelection?.value) ||
    defaultModel;
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this return statement's awaited sequencing and rejected-Promise behavior. */
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        // oxlint-disable-next-line react/forbid-component-props -- ModelSelector accepts className in its styling contract; preserve this caller's layout and appearance.
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        allowMultiple={Boolean(modelSelection)}

        onModelSelectionChangeAction={async (selection) => {
          if (modelSelection) {
            await modelSelection.onChange(selection);
            return;
          }
          const model =
            // oxlint-disable-next-line no-ternary -- Keep model as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            typeof selection === "string" ? getModelById(selection) : undefined;
          if (model) {
            await changeModel(model.id);
          }
        }}
        selectedModelId={selectedModel}
        selectedModelSelection={
          /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading value from modelSelection; preserve one receiver evaluation, skipped accesses and the existing selectedModel fallback. The app guidance prefers optional chaining. */
          modelSelection?.value ??
          /* oxlint-enable oxc/no-optional-chaining */ selectedModel
        }
      />
    </fieldset>
  );
  /* oxlint-enable oxc/no-async-await */
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions, typescript/strict-void-return */
