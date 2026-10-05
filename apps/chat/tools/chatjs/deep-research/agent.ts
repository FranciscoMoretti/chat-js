import { defineAgent, defineDynamic } from "eve";
import type { DefinedAgent } from "eve";

import { resolveEveModel } from "@/lib/eve/model-selection";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getDeepResearchConfig } from "./configuration";
/* oxlint-enable sort-imports */

type Phase = "research" | "compression" | "final_report";
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
/* oxlint-enable oxc/no-async-await */
