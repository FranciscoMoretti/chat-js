"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";

import { ModelSelector } from "@/components/model-selector";
import { getPrimarySelectedModelId } from "@/lib/ai/types";
import type { SelectedModelValue } from "@/lib/ai/types";
import { useChatModels } from "@/providers/chat-models-provider";
import {
  useDefaultModel,
  useModelChange,
} from "@/providers/default-model-provider";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return -- EveModelPicker: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-async-await: await preserves ordered requests and catch behavior in this feature operation; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including getModelById(id)?.name); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including retainedModelId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

export const EveModelPicker = ({
  disabled = false,
  retainedModelId,
  retainedModelIds,
  modelSelection,
}: {
  disabled?: boolean;
  retainedModelId?: string;
  retainedModelIds?: string[];
  modelSelection?: {
    value: SelectedModelValue;
    onChange: (value: SelectedModelValue) => Promise<void>;
  };
}) => {
  const defaultModel = useDefaultModel();
  const changeModel = useModelChange();
  const { getModelById } = useChatModels();
  if (retainedModelIds) {
    const names = retainedModelIds
      .map((id) => getModelById(id)?.name ?? id)
      .join(", ");
    return (
      <span className="inline-flex h-8 items-center px-2 text-sm" title={names}>
        {retainedModelIds.length} models
      </span>
    );
  }
  const selectedModel =
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
    (retainedModelId && getModelById(retainedModelId)?.id) ||
    // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
    getPrimarySelectedModelId(modelSelection?.value) ||
    defaultModel;
  return (
    <fieldset disabled={disabled}>
      <ModelSelector
        className="h-8 w-fit max-w-none shrink justify-start truncate px-2 text-xs @[500px]:h-10 @[500px]:px-3 @[500px]:text-sm"
        allowMultiple={Boolean(modelSelection)}

        // oxlint-disable-next-line typescript/no-misused-promises -- #585: Model selection awaits persistence before updating its parent; callback typing must preserve that coordination.
        onModelSelectionChangeAction={async (selection) => {
          if (modelSelection) {
            await modelSelection.onChange(selection);
            return;
          }
          const model =
            typeof selection === "string" ? getModelById(selection) : undefined;
          if (model) {
            await changeModel(model.id);
          }
        }}
        selectedModelId={selectedModel}
        selectedModelSelection={modelSelection?.value ?? selectedModel}
      />
    </fieldset>
  );
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-ternary, no-undefined, oxc/no-async-await, oxc/no-optional-chaining, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, typescript/strict-void-return */
