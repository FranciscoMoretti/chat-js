import { Output, generateText } from "ai";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { HookModelCall, TurnCompletedHookResult } from "eve/hooks";
/* oxlint-enable sort-imports */

import { config } from "@/lib/config";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { FollowupContext } from "./followup-context";
/* oxlint-enable sort-imports */
import { eveFollowupSuggestions } from "./followup-suggestions";
import { resolveEveModel } from "./model-selection";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (generateEveFollowupSuggestions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve generateEveFollowupSuggestions's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-statements --
 * max-statements (#512): Record provider step usage before parsing suggestion output, then retain an unknown-cost receipt if an attempted call fails before any step callback; this accounting boundary must remain visible through the catch path.
 */
/** Auxiliary generation belongs to the native turn and never fails its answer.
 * @param {Readonly<FollowupContext>} context User and completed assistant text supplying auxiliary suggestion generation.
 * @returns {Promise<TurnCompletedHookResult | undefined>} No result when disabled/empty; otherwise native model usage and validated suggestion metadata, retaining billed attempts even when output parsing fails.
 */
export const generateEveFollowupSuggestions = async (
  context: Readonly<FollowupContext>
): Promise<TurnCompletedHookResult | undefined> => {
  if (
    !(config.ai.tools.followupSuggestions.enabled && context.assistant.trim())
  ) {
    return;
  }
  const modelId = config.ai.tools.followupSuggestions.default;
  const modelCalls: HookModelCall[] = [];
  let attempted = false;
  try {
    const resolved = await resolveEveModel(modelId);
    attempted = true;
    const result = await generateText({
      model: resolved.model,
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing resolved.modelOptions own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...resolved.modelOptions,
      // oxlint-disable-next-line no-magic-numbers -- Bound optional follow-up generation to fifteen seconds without failing the completed answer.
      abortSignal: AbortSignal.timeout(15_000),
      maxOutputTokens: 512,
      // Hidden provider retries would lose per-attempt usage evidence.
      maxRetries: 0,
      messages: [
        { content: context.user, role: "user" },
        { content: context.assistant, role: "assistant" },
        {
          content:
            "What question should I ask next? Return 3 to 5 distinct suggested questions, each at most 80 characters. Use the conversation's language.",
          role: "user",
        },
      ],
      // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Native SDK step usage/providerMetadata are forwarded unchanged into HookModelCall receipts; readonly JSON collections change the native receipt input contract.
      onStepEnd(step): void {
        modelCalls.push({
          modelId,
          providerMetadata: step.providerMetadata,
          usage: step.usage,
        });
      },
      output: Output.object({ schema: eveFollowupSuggestions }),
    });
    // Usage is captured before reading output: malformed JSON can still cost money.
    // oxlint-disable-next-line typescript/consistent-return -- #580: generateEveFollowupSuggestions has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return {
      modelCalls,
      responseMetadata: eveFollowupSuggestions.parse(result.output),
    };
  } catch {
    // oxlint-disable-next-line no-magic-numbers -- A failed attempt without captured steps must still create one unknown-cost usage receipt.
    if (attempted && modelCalls.length === 0) {
      modelCalls.push({ failed: true, modelId });
    }
    // oxlint-disable-next-line typescript/consistent-return -- #580: generateEveFollowupSuggestions has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return { modelCalls };
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
