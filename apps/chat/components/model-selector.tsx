"use client";

import React, { memo } from "react";
import type { ComponentProps } from "react";
import { ModelSettingsLink } from "@/components/chat-slots";
import { LoginCtaBanner } from "@/components/upgrade-cta/login-cta-banner";
import { getEnabledFeatures } from "@/lib/features-config";
import { useChatModels } from "@/providers/chat-models-provider";
import { useSession } from "@/providers/session-provider";
import { ModelSelectorView } from "./model-selector-view";

const enabledFeatures = getEnabledFeatures();

const ConnectedModelSelector = (
  props: Pick<
    ComponentProps<typeof ModelSelectorView>,
    | "allowMultiple"
    | "selectedModelId"
    | "selectedModelSelection"
    | "onModelSelectionChangeAction"
    | "className"
  >
): React.JSX.Element => {
  const { data: session } = useSession();
  const { models, allModels } = useChatModels();
  const isAnonymous = !session?.user;
  return (
    <ModelSelectorView
      {...props}
      allowMultiple={props.allowMultiple === true && !isAnonymous}
      chatModels={models}
      allModels={allModels}
      modelsDisabled={isAnonymous}
      enabledFeatures={enabledFeatures}
      footer={!isAnonymous && <ModelSettingsLink surface="picker" />}
      disabledModelsNotice={
        <LoginCtaBanner
          compact
          message="Sign in to unlock all models."
          variant="default"
        />
      }
    />
  );
};
export const ModelSelector = memo(ConnectedModelSelector);
