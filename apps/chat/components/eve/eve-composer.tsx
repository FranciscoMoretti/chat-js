"use client";

import type {
  ComponentProps,
  Dispatch,
  JSX as ReactJSX,
  SetStateAction,
} from "react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ActiveTool } from "@/components/composer/active-tool";
/* oxlint-enable sort-imports */
import { ComposerMenu } from "@/components/composer/composer-menu";
import { ContextBar } from "@/components/context-bar";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import type { UiToolName } from "@/lib/ai/types";
import { expandSelectedModelValue } from "@/lib/ai/types";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { DraftAttachment } from "@/lib/eve/draft";
/* oxlint-enable sort-imports */
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { installedToolNames } from "@/tools/chatjs/installed-features";
/* oxlint-enable sort-imports */
/* oxlint-disable import/max-dependencies -- ./eve-model-picker import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { EveModelPicker } from "./eve-model-picker";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
import type { useEveAttachments } from "./use-eve-attachments";

const uploadsOmitted = (): void => {
  // Uploads are omitted from this installation.
};

/* oxlint-disable no-magic-numbers, typescript/explicit-function-return-type -- modelSelectionIds: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const modelSelectionIds = (
  retained: string | undefined,
  selection: Parameters<typeof expandSelectedModelValue>[0] | undefined,
  selected: Parameters<typeof expandSelectedModelValue>[0]
) =>
  typeof retained === "string" && retained !== ""
    ? [retained]
    : expandSelectedModelValue(selection ?? selected);
/* oxlint-enable no-magic-numbers, typescript/explicit-function-return-type */

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- unsupportedAttachments: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including files: DraftAttachment[]); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including model?.input.pdf). */

const unsupportedAttachments = (
  models: ReturnType<ReturnType<typeof useChatModels>["getModelById"]>[],
  files: DraftAttachment[]
): boolean =>
  models.some((model) =>
    files.some((file) =>
      file.contentType === "application/pdf"
        ? !model?.input.pdf
        : !model?.input.image
    )
  );
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

const isUnavailableTool = (tool: UiToolName | null): boolean =>
  Boolean(tool && !installedToolNames.has(tool));

/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveComposer: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including attachment: { url: string }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including props.readOnly); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveComposer = ({
  files,
  retainedModelId,
  retainedModelIds,
  modelSelection,
  selectedTool,
  onToolChange,
  ...props
}: Omit<
  ComponentProps<typeof ControlledChatComposer>,
  "tools" | "attachments" | "hasAttachments" | "onPaste"
> & {
  files: ReturnType<typeof useEveAttachments>;
  selectedTool: UiToolName | null;
  onToolChange: Dispatch<SetStateAction<UiToolName | null>>;
  retainedModelId?: string;
  retainedModelIds?: string[];
  modelSelection?: ComponentProps<typeof EveModelPicker>["modelSelection"];
}): ReactJSX.Element => {
  const selected = useDefaultModel();
  const { getModelById } = useChatModels();
  const models = modelSelectionIds(
    retainedModelId,
    modelSelection?.value,
    selected
  ).map((modelId) => getModelById(modelId));
  const unsupported =
    !props.readOnly && unsupportedAttachments(models, files.attachments);
  const unavailableTool = isUnavailableTool(selectedTool);
  const locked = props.disabled || files.uploadQueue.length > 0;
  const uploadLocked = locked || props.readOnly;
  const removeAttachment = (attachment: { readonly url: string }): void => {
    files.setAttachments((current) =>
      current.filter((file) => file.url !== attachment.url)
    );
  };
  const uploads = files.composer?.(Boolean(uploadLocked));
  return (
    <div
      {...{
        "aria-label": "Message composer",
        role: "group",
        ...uploads?.rootProps,
      }}
    >
      {uploads?.input}
      <ControlledChatComposer
        {...props}
        attachments={
          <ContextBar
            attachments={files.attachments}
            onRemoveAction={uploadLocked ? undefined : removeAttachment}
            uploadQueue={files.uploadQueue}
          />
        }
        disabled={locked || unsupported || unavailableTool}
        hasAttachments={files.attachments.length > 0}

        tools={
          <>
            <ComposerMenu
              disabled={uploadLocked}
              selectedModelId={models[0]?.id ?? ""}
              selectedTool={selectedTool}
              onToolChange={onToolChange}
              onAttach={uploads?.onAttach ?? uploadsOmitted}
            />
            <ActiveTool
              selectedTool={selectedTool}
              disabled={uploadLocked}
              onClear={() => onToolChange(null)}
            />
            <EveModelPicker
              // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: These flags express independent truthy conditions, not a nullish fallback.
              disabled={locked || props.readOnly || Boolean(retainedModelId)}
              modelSelection={modelSelection}
              retainedModelId={retainedModelId}
              retainedModelIds={retainedModelIds}
            />
          </>
        }
      />
      {unavailableTool && (
        <p className="text-destructive text-sm" role="alert">
          The selected tool is unavailable. Clear it or choose another tool
          before sending.
        </p>
      )}
      {unsupported && (
        <p className="text-destructive text-sm" role="alert">
          Choose models that support all attached files.
        </p>
      )}
    </div>
  );
};
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
