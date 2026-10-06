/* oxlint-disable import/no-nodejs-modules -- The compiled fixture records effects and reads its disposable connector configuration. */
import { appendFile, readFile } from "node:fs/promises";

/* oxlint-enable import/no-nodejs-modules */
import { defineDynamic, defineTool } from "eve/tools";
import { z } from "zod";

/* oxlint-disable import/no-relative-parent-imports -- The fixture shares its barrier helpers inside the isolated app root. */
import { barrier, mark } from "../../control";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- EVE supplies compiled callback contexts; the fixture reads their SDK-owned mutable types. */
// oxlint-disable-next-line import/no-default-export -- EVE compiles the dynamic resolver and its captured callbacks from this default export.
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

/* oxlint-enable typescript/prefer-readonly-parameter-types */
