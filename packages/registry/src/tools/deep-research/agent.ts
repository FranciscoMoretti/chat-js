import { defineAgent, defineDynamic } from "eve";
import type { DefinedAgent, DynamicResolveContext } from "eve";

import { resolveAccountedEveModel } from "@/lib/eve/model-accounting";

import { getDeepResearchConfig } from "./configuration";

type Phase = "research" | "compression" | "final_report";
export const defineResearchAgent = (
  phase: Phase
): DefinedAgent<{
  defaultTools: false;
  description: string;
  model: ReturnType<
    typeof defineDynamic<{
      "step.started": (
        event: unknown,
        context: DynamicResolveContext
      ) => ReturnType<typeof resolveAccountedEveModel>;
    }>
  >;
  tool: false;
}> =>
  defineAgent({
    defaultTools: false,
    description: `Deep research ${phase} phase. Called by the research workflow.`,
    model: defineDynamic({
      events: {
        "step.started": async (event, context) =>
          await resolveAccountedEveModel(
            getDeepResearchConfig()[`${phase}_model`],
            event,
            context
          ),
      },
    }),
    tool: false,
  });
