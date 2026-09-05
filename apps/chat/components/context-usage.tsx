"use client";

import type { LanguageModelUsage } from "ai";
import { useMemo } from "react";
import type { ModelId as TokenLensModelId } from "tokenlens";
import { getContextWindow } from "tokenlens";
import {
  Context,
  ContextCacheUsage,
  ContextContent,
  ContextContentBody,
  ContextContentFooter,
  ContextContentHeader,
  ContextInputUsage,
  ContextOutputUsage,
  ContextReasoningUsage,
  ContextTrigger,
} from "@/components/ai-elements/context";
import { Button } from "@/components/ui/button";
import type { AppModelId, ModelId } from "@/lib/ai/app-models";
import { useLastUsageUntilMessageId } from "@/lib/stores/hooks-base";
import { useChatModels } from "@/providers/chat-models-provider";

const ICON_RADIUS = 10;
const ICON_VIEWBOX = 24;
const ICON_CENTER = 12;
const ICON_STROKE_WIDTH = 2;

function ContextIconStandalone({
  usedTokens,
  maxTokens,
}: {
  usedTokens: number;
  maxTokens: number;
}) {
  const circumference = 2 * Math.PI * ICON_RADIUS;
  const usedPercent = usedTokens / maxTokens;
  const dashOffset = circumference * (1 - usedPercent);

  return (
    <svg
      aria-label="Model context usage"
      height="20"
      role="img"
      style={{ color: "currentcolor" }}
      viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
      width="20"
    >
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.25"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
      />
      <circle
        cx={ICON_CENTER}
        cy={ICON_CENTER}
        fill="none"
        opacity="0.7"
        r={ICON_RADIUS}
        stroke="currentColor"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        strokeWidth={ICON_STROKE_WIDTH}
        style={{ transformOrigin: "center", transform: "rotate(-90deg)" }}
      />
    </svg>
  );
}

function ContextUsage({
  usage,
  selectedModelId,
  iconOnly = false,
}: {
  usage: LanguageModelUsage;
  selectedModelId: ModelId;
  iconOnly?: boolean;
}) {
  const contextMax = useMemo(() => {
    try {
      const cw = getContextWindow(selectedModelId as unknown as string);
      return cw.combinedMax ?? cw.inputMax ?? 0;
    } catch {
      return 0;
    }
  }, [selectedModelId]);

  const usedTokens = useMemo(() => {
    if (!usage) {
      return 0;
    }
    const input = usage.inputTokens ?? 0;
    const cached = usage.inputTokenDetails.cacheReadTokens ?? 0;
    return input + cached;
  }, [usage]);

  return (
    <Context
      maxTokens={contextMax}
      modelId={selectedModelId.split("/").join(":") as TokenLensModelId}
      usage={usage as LanguageModelUsage | undefined}
      usedTokens={usedTokens}
    >
      <ContextTrigger>
        {iconOnly ? (
          <Button className="size-8 p-0" type="button" variant="ghost">
            <ContextIconStandalone
              maxTokens={contextMax}
              usedTokens={usedTokens}
            />
          </Button>
        ) : undefined}
      </ContextTrigger>
      <ContextContent align="end">
        <ContextContentHeader />
        <ContextContentBody className="space-y-2">
          <ContextInputUsage />
          <ContextOutputUsage />
          <ContextReasoningUsage />
          <ContextCacheUsage />
        </ContextContentBody>
        <ContextContentFooter />
      </ContextContent>
    </Context>
  );
}

export function ContextUsageFromParent({
  parentMessageId,
  selectedModelId,
  iconOnly = false,
  className,
}: {
  parentMessageId: string | null;
  selectedModelId: AppModelId;
  iconOnly?: boolean;
  className?: string;
}) {
  const usage = useLastUsageUntilMessageId(parentMessageId);
  const { getModelById } = useChatModels();
  const modelDefinition = getModelById(selectedModelId);

  if (!(usage && modelDefinition)) {
    return null;
  }

  return (
    <div className={className}>
      <ContextUsage
        iconOnly={iconOnly}
        selectedModelId={modelDefinition.apiModelId}
        usage={usage}
      />
    </div>
  );
}
