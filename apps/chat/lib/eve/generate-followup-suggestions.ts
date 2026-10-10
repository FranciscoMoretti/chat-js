import type { HookModelCall, TurnCompletedHookResult } from "eve/hooks";
import { Output, generateText } from "ai";
import type { FollowupContext } from "./followup-context";
import { config } from "@/lib/config";
import { eveFollowupSuggestions } from "./followup-suggestions";
import { resolveEveModel } from "./model-selection";

const FOLLOWUP_TIMEOUT_MS = 15_000;

type NativeFollowupUsage = NonNullable<HookModelCall["usage"]>;
type ReadonlyFollowupUsage = Readonly<
  Omit<NativeFollowupUsage, "inputTokenDetails" | "outputTokenDetails" | "raw">
> & {
  readonly inputTokenDetails: Readonly<
    NativeFollowupUsage["inputTokenDetails"]
  >;
  readonly outputTokenDetails: Readonly<
    NativeFollowupUsage["outputTokenDetails"]
  >;
  readonly raw?: Readonly<NonNullable<NativeFollowupUsage["raw"]>>;
};
type ReadonlyFollowupProviderMetadata = {
  readonly [
    Provider in keyof NonNullable<HookModelCall["providerMetadata"]>
  ]: Readonly<NonNullable<HookModelCall["providerMetadata"]>[Provider]>;
};
interface FollowupStep {
  readonly providerMetadata?: ReadonlyFollowupProviderMetadata;
  readonly usage?: ReadonlyFollowupUsage;
}

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
  context: FollowupContext
): Promise<TurnCompletedHookResult | undefined> => {
  if (
    !(config.ai.tools.followupSuggestions.enabled && context.assistant.trim())
  ) {
    // oxlint-disable-next-line no-undefined -- Disabled suggestions intentionally have no hook result; an explicit value keeps all async return paths consistent.
    return undefined;
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
      abortSignal: AbortSignal.timeout(FOLLOWUP_TIMEOUT_MS),
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
      onStepEnd(step: FollowupStep): void {
        modelCalls.push({
          modelId,
          providerMetadata: step.providerMetadata,
          usage: step.usage,
        });
      },
      output: Output.object({ schema: eveFollowupSuggestions }),
    });
    // Usage is captured before reading output: malformed JSON can still cost money.
    return {
      modelCalls,
      responseMetadata: eveFollowupSuggestions.parse(result.output),
    };
  } catch {
    // oxlint-disable-next-line no-magic-numbers -- A failed attempt without captured steps must still create one unknown-cost usage receipt.
    if (attempted && modelCalls.length === 0) {
      modelCalls.push({ failed: true, modelId });
    }
    return { modelCalls };
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements */
