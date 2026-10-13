import { defineAgent, defineDynamic } from "eve";
import type { DefinedAgent } from "eve";

import { getDeepResearchConfig } from "./configuration";
import { resolveEveModel } from "@/lib/eve/model-selection";

type Phase = "research" | "compression" | "final_report";
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
