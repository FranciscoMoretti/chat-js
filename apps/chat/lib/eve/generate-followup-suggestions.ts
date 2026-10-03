/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../config" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { generateText, Output } from "ai";
import type { HookModelCall, TurnCompletedHookResult } from "eve/hooks";

import { config } from "../config";
import type { FollowupContext } from "./followup-context";
import { eveFollowupSuggestions } from "./followup-suggestions";
import { resolveEveModel } from "./model-selection";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types --
 * import/no-named-export (#527): Preserve the named generateEveFollowupSuggestions API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): generateEveFollowupSuggestions remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): generateEveFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): generateEveFollowupSuggestions's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-statements (#512): generateEveFollowupSuggestions keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): generateEveFollowupSuggestions uses 15_000, 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * oxc/no-async-await (#540): generateEveFollowupSuggestions sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): generateEveFollowupSuggestions copies or separates ...resolved.modelOptions while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): generateEveFollowupSuggestions accepts context: FollowupContext; step; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Auxiliary generation belongs to the native turn and never fails its answer. */
export const generateEveFollowupSuggestions = async (
  context: FollowupContext
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
      ...resolved.modelOptions,
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
      // oxlint-disable-next-line typescript/no-deprecated -- #583: Usage accounting depends on the installed SDK callback contract; callback lifecycle migration needs billing verification.
      onStepFinish(step): void {
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
    if (attempted && modelCalls.length === 0) {
      modelCalls.push({ failed: true, modelId });
    }
    // oxlint-disable-next-line typescript/consistent-return -- #580: generateEveFollowupSuggestions has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return { modelCalls };
  }
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types */
