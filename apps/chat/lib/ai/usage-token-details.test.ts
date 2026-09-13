import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  Context,
  ContextCacheUsage,
  ContextReasoningUsage,
} from "@/components/ai-elements/context";

import { getUsageTokenDetails } from "./usage-token-details";

describe("persisted token usage", () => {
  it("renders legacy usage counts without requiring nested SDK 7 objects", () => {
    const html = renderToStaticMarkup(
      createElement(
        Context,
        {
          maxTokens: 1000,
          usage: {
            cachedInputTokens: 30,
            inputTokens: 100,
            outputTokens: 20,
            reasoningTokens: 7,
            totalTokens: 120,
          },
          usedTokens: 100,
        },
        createElement(ContextCacheUsage),
        createElement(ContextReasoningUsage)
      )
    );
    expect(html).toContain("30");
    expect(html).toContain("7");
  });

  it("preserves SDK 6 cache and reasoning counts without nested details", () => {
    expect(
      getUsageTokenDetails({
        cachedInputTokens: 30,
        inputTokens: 100,
        outputTokens: 20,
        reasoningTokens: 7,
        totalTokens: 120,
      })
    ).toEqual({ cachedInputTokens: 30, reasoningTokens: 7 });
  });
  it("prefers SDK 7 details including zero over legacy counts", () => {
    expect(
      getUsageTokenDetails({
        cachedInputTokens: 30,
        inputTokenDetails: {
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          noCacheTokens: 100,
        },
        inputTokens: 100,
        outputTokenDetails: { reasoningTokens: 0, textTokens: 20 },
        outputTokens: 20,
        reasoningTokens: 7,
        totalTokens: 120,
      })
    ).toEqual({ cachedInputTokens: 0, reasoningTokens: 0 });
  });
  it("handles missing usage and optional historical counts", () => {
    expect(getUsageTokenDetails()).toEqual({
      cachedInputTokens: 0,
      reasoningTokens: 0,
    });
    expect(
      getUsageTokenDetails({
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
      })
    ).toEqual({ cachedInputTokens: 0, reasoningTokens: 0 });
  });
});
