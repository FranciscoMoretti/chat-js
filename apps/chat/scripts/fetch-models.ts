/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This executable writes its generated source through Node’s promise-based filesystem API.
 */
import { getActiveGateway } from "@/lib/ai/active-gateway";
import { writeFile } from "node:fs/promises";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchAndSaveModels's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

const EMPTY_MODEL_COUNT = 0;
const GENERATED_JSON_INDENT_SPACES = 2;

/* oxlint-disable no-console, unicorn/no-null --
 * no-console (#514): Progress logs report the selected gateway, model count, and generated file path to the command's stdout.
 * unicorn/no-null (#570): JSON.stringify receives null as the no-replacer argument to preserve values while applying generated-source indentation.
 */
const fetchAndSaveModels = async (): Promise<void> => {
  const gateway = getActiveGateway();

  console.log(`Fetching models from '${gateway.type}' gateway...`);
  const models = await gateway.fetchModels();

  if (models.length === EMPTY_MODEL_COUNT) {
    throw new Error("No models returned from gateway");
  }

  const fileContent = `import type { AiGatewayModel } from "@chat-js/gateways/models";

export const generatedForGateway = "${gateway.type}";

export const models = ${JSON.stringify(models, null, GENERATED_JSON_INDENT_SPACES)} as const satisfies readonly AiGatewayModel[];
`;

  await writeFile("lib/ai/models.generated.ts", fileContent);
  console.log(
    `Wrote ${models.length} models from '${gateway.type}' gateway to lib/ai/models.generated.ts`
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console, unicorn/no-null */

// oxlint-disable-next-line node/no-top-level-await -- This executable completes model fetching and file publication before the command finishes.
await fetchAndSaveModels();
