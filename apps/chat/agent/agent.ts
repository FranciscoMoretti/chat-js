import { defineAgent, defineDynamic } from "eve";
import { defineState } from "eve/context";
import { z } from "zod";
import { resolveEveModel } from "../lib/eve/model-selection";

const turnModel = defineState<{ turnId: string; modelId?: string }>(
  "chatjs.turn-model",
  () => ({ turnId: "" })
);
const stepEvent = z.object({ data: z.object({ turnId: z.string() }) });

export default defineAgent({
  build: { externalDependencies: ["pino", "pino-pretty", "thread-stream"] },
  model: defineDynamic({
    events: {
      "step.started": (event, context) => {
        const { turnId } = stepEvent.parse(event).data;
        // Eve 0.52.2 approval continuations can emit an empty turn ID.
        // They must retain the paused turn's model, not start a new selection.
        if (turnId && turnModel.get().turnId !== turnId) {
          const modelId = context.session.auth.current?.attributes.modelId;
          turnModel.update(() => ({
            turnId,
            modelId: typeof modelId === "string" ? modelId : undefined,
          }));
        }
        return resolveEveModel(turnModel.get().modelId);
      },
    },
  }),
  experimental: { workflow: { world: "@workflow/world-postgres" } },
});
