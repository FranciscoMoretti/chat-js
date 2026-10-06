/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This executable writes its generated source through Node’s promise-based filesystem API.
 */
import { writeFile } from "node:fs/promises";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getActiveGateway } from "@/lib/ai/active-gateway";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve fetchAndSaveModels's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable no-console, no-magic-numbers, unicorn/no-null --
 * no-console (#514): fetchAndSaveModels emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): 0 denotes the empty model-list check and 2 is the generated JSON indentation width; both preserve the existing output format.
 * unicorn/no-null (#570): JSON.stringify receives null as the no-replacer argument to preserve values while applying generated-source indentation.
 */
const fetchAndSaveModels = async (): Promise<void> => {
  const gateway = getActiveGateway();

  console.log(`Fetching models from '${gateway.type}' gateway...`);
  const models = await gateway.fetchModels();

  if (models.length === 0) {
    throw new Error("No models returned from gateway");
  }

  const fileContent = `import type { AiGatewayModel } from "@chat-js/gateways/models";

export const generatedForGateway = "${gateway.type}";

export const models = ${JSON.stringify(models, null, 2)} as const satisfies readonly AiGatewayModel[];
`;

  await writeFile("lib/ai/models.generated.ts", fileContent);
  console.log(
    `Wrote ${models.length} models from '${gateway.type}' gateway to lib/ai/models.generated.ts`
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console, no-magic-numbers, unicorn/no-null */

// oxlint-disable-next-line node/no-top-level-await -- This executable completes model fetching and file publication before the command finishes.
await fetchAndSaveModels();
