"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import React from "react";
import type { ComponentProps, Dispatch, SetStateAction } from "react";

import { ActiveTool } from "@/components/composer/active-tool";
import { ComposerMenu } from "@/components/composer/composer-menu";
import { ContextBar } from "@/components/context-bar";
import { ControlledChatComposer } from "@/components/controlled-chat-composer";
import { expandSelectedModelValue } from "@/lib/ai/types";
import type { UiToolName } from "@/lib/ai/types";
import type { DraftAttachment } from "@/lib/eve/draft";
import { useChatModels } from "@/providers/chat-models-provider";
import { useDefaultModel } from "@/providers/default-model-provider";
import { installedToolNames } from "@/tools/chatjs/installed-features";
/* oxlint-disable import/max-dependencies -- ./eve-model-picker import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */

import { EveModelPicker } from "./eve-model-picker";
/* oxlint-enable import/max-dependencies */
import type { useEveAttachments } from "./use-eve-attachments";
/* oxlint-enable sort-imports */
/* oxlint-disable typescript/explicit-function-return-type -- uploadsOmitted: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const uploadsOmitted = () => {
  // Uploads are omitted from this installation.
};
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable no-magic-numbers, no-ternary, typescript/explicit-function-return-type -- modelSelectionIds: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */
const modelSelectionIds = (
  retained: string | undefined,
  selection: Parameters<typeof expandSelectedModelValue>[0] | undefined,
  selected: Parameters<typeof expandSelectedModelValue>[0]
) =>
  typeof retained === "string" && retained !== ""
    ? [retained]
    : expandSelectedModelValue(selection ?? selected);
/* oxlint-enable no-magic-numbers, no-ternary, typescript/explicit-function-return-type */

/* oxlint-disable no-ternary, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- unsupportedAttachments: no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including model?.input.pdf); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including files: DraftAttachment[]); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including model?.input.pdf). */

const unsupportedAttachments = (
  models: ReturnType<ReturnType<typeof useChatModels>["getModelById"]>[],
  files: DraftAttachment[]
) =>
  models.some((model) =>
    files.some((file) =>
      file.contentType === "application/pdf"
        ? !model?.input.pdf
        : !model?.input.image
    )
  );
/* oxlint-enable no-ternary, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/explicit-function-return-type -- isUnavailableTool: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result. */

const isUnavailableTool = (tool: UiToolName | null) =>
  Boolean(tool && !installedToolNames.has(tool));
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveComposer: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable (including uploadLocked ? undefined : removeAttachment); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including modelSelection?.value); oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including attachment: { url: string }); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including props.readOnly); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
}) => {
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
  const removeAttachment = (attachment: { url: string }) => {
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, max-lines-per-function, no-magic-numbers, no-ternary, no-undefined, oxc/no-optional-chaining, oxc/no-rest-spread-properties, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/jsx-no-literals, react/jsx-props-no-spreading, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
