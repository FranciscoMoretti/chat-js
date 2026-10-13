import { appendFile, readFile } from "node:fs/promises";

import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

import { barrier, mark } from "../../control";

export default defineDynamic({
  events: {
    "step.started": async () => {
      const connectorIdentity = await readFile("connector.txt", "utf-8");
      return {
        act: defineTool({
          approval: {
            request: async (context): Promise<"user-approval"> => {
              await mark("request", {
                connectorIdentity,
                input: context.toolInput,
                toolName: context.toolName,
              });
              return "user-approval";
            },
            response: async ({ response }) => {
              if (response.principal.principalId !== "owner") {
                return { reason: "Owner required", status: "rejected" };
              }
              await barrier("candidate", {
                connectorIdentity,
                decision: response.decision,
              });
              return { status: "allowed" };
            },
          },
          description:
            "A dynamic action with a captured connector identity and parsed input",
          execute: async (input, context) => {
            const evidence = {
              callId: context.callId,
              connectorIdentity,
              input,
              pid: process.pid,
              sessionId: context.session.id,
              toolName: context.toolName,
            };
            await appendFile("effects.jsonl", `${JSON.stringify(evidence)}\n`);
            await mark("effect", evidence);
            return evidence;
          },
          inputSchema: z.object({
            amount: z.coerce.number(),
            label: z
              .string()
              .default(" default ")
              .transform((value) => value.trim()),
          }),
        }),
      };
    },
  },
});
