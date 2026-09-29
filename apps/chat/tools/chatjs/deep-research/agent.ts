import { defineAgent, defineDynamic } from "eve";

import { resolveEveModel } from "@/lib/eve/model-selection";

import { getDeepResearchConfig } from "./configuration";

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
