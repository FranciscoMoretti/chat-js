import { defineAgent, defineDynamic } from "eve";

import { getDeepResearchConfig } from "../../tools/platform/deep-research/configuration";
import { resolveEveModel } from "./model-selection";

export const defineResearchAgent = (
  phase: "research" | "compression" | "final_report"
) =>
  defineAgent({
    defaultTools: false,
    description: `Deep research ${phase} phase. Called by the research workflow.`,
    model: defineDynamic({
      events: {
        "step.started": () =>
          resolveEveModel(getDeepResearchConfig()[`${phase}_model`]),
      },
    }),
    tool: false,
  });
