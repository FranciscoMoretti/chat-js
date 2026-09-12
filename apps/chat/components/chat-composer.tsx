"use client";

import { memo } from "react";
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
export const ChatComposer = memo(
  (props: Omit<ComponentProps<typeof MultimodalInput>, "children">) => (
    <MultimodalInput {...props}>
      <ComposerLimits />
      <ComposerAttachments />
      <ComposerInput />
      <PromptInputFooter className="flex w-full min-w-0 flex-row items-center justify-between gap-1 border-t px-1 py-1 group-has-[>input]/input-group:pb-1 @[500px]:gap-2 [.border-t]:pt-1">
        <PromptInputTools className="flex min-w-0 items-center gap-1 @[500px]:gap-2">
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
  )
);

ChatComposer.displayName = "ChatComposer";
