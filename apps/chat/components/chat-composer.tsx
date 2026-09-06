"use client";

import type { ComponentProps } from "react";
import {
  PromptInputFooter,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { ConnectorsDropdown } from "@/components/connectors-dropdown";
import {
  ComposerAttachButton,
  ComposerAttachments,
  ComposerContextUsage,
  ComposerInput,
  ComposerLimits,
  ComposerModelPicker,
  ComposerSubmit,
  ComposerTools,
  MultimodalInput,
} from "@/components/multimodal-input";

/** The reference app's composer. Add, remove or reorder controls here. */
export function ChatComposer(
  props: Omit<ComponentProps<typeof MultimodalInput>, "children">
) {
  return (
    <MultimodalInput {...props}>
      <ComposerLimits />
      <ComposerAttachments />
      <ComposerInput />
      <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between @[500px]:gap-2 gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 [.border-t]:pt-1">
        <PromptInputTools className="flex min-w-0 items-center @[500px]:gap-2 gap-1">
          <ComposerAttachButton />
          <ComposerModelPicker />
          <ConnectorsDropdown />
          <ComposerTools />
        </PromptInputTools>
        <div className="flex items-center gap-1">
          <ComposerContextUsage />
          <ComposerSubmit />
        </div>
      </PromptInputFooter>
    </MultimodalInput>
  );
}
