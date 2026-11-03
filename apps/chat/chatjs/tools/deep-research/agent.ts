import { defineAgent, defineDynamic } from "eve";
import { resolveAccountedEveModel } from "@/lib/eve/model-accounting";
import { getDeepResearchConfig } from "./configuration";

type Phase = "research" | "compression" | "final_report";
export const defineResearchAgent = (phase: Phase) =>
  defineAgent({
    defaultTools: false,
    description: `Deep research ${phase} phase. Called by the research workflow.`,
    model: defineDynamic(
      async (context) =>
        await resolveAccountedEveModel(
          getDeepResearchConfig()[`${phase}_model`],
          context
        )
    ),
    tool: false,
  });
