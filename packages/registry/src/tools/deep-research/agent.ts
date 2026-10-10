import { defineAgent, defineDynamic } from "eve";
import type { DefinedAgent } from "eve";

import { getDeepResearchConfig } from "./configuration";
import { resolveEveModel } from "@/lib/eve/model-selection";

type Phase = "research" | "compression" | "final_report";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (defineResearchAgent); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve defineResearchAgent's awaited sequencing and rejected-Promise behavior. */
export const defineResearchAgent = (
  phase: Phase
): DefinedAgent<{
  defaultTools: false;
  description: string;
  model: ReturnType<
    typeof defineDynamic<{
      "step.started": () => ReturnType<typeof resolveEveModel>;
    }>
  >;
  tool: false;
}> =>
  defineAgent({
    defaultTools: false,
    description: `Deep research ${phase} phase. Called by the research workflow.`,
    model: defineDynamic({
      events: {
        "step.started": async () =>
          await resolveEveModel(getDeepResearchConfig()[`${phase}_model`]),
      },
    }),
    tool: false,
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
