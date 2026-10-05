/* oxlint-disable import/no-nodejs-modules, import/no-relative-parent-imports --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { writeFileSync } from "node:fs";; its Node runtime boundary deliberately permits these built-ins.
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/ai/active-gateway" dependency within this package instead of introducing an alias or barrel API.
 */
import { writeFileSync } from "node:fs";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getActiveGateway } from "../lib/ai/active-gateway";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules, import/no-relative-parent-imports */

/* oxlint-disable no-console, no-magic-numbers, node/no-sync, typescript/strict-boolean-expressions, unicorn/no-null --
 * no-console (#514): fetchAndSaveModels emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): fetchAndSaveModels uses 0, 2 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * node/no-sync (#538): fetchAndSaveModels uses writeFileSync("lib/ai/models.generated.ts", fileContent) within its synchronous startup or SDK contract; asynchronous conversion changes its callers and lifecycle.
 * typescript/strict-boolean-expressions (#610): fetchAndSaveModels intentionally keeps the existing falsy-value behavior of models; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): fetchAndSaveModels preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
const fetchAndSaveModels = async (): Promise<void> => {
  const gateway = getActiveGateway();

  console.log(`Fetching models from '${gateway.type}' gateway...`);
  const models = await gateway.fetchModels();

  if (!models || models.length === 0) {
    throw new Error("No models returned from gateway");
  }

  const fileContent = `import type { AiGatewayModel } from "@chat-js/gateways/models";

export const generatedForGateway = "${gateway.type}";

export const models = ${JSON.stringify(models, null, 2)} as const satisfies readonly AiGatewayModel[];
`;

  writeFileSync("lib/ai/models.generated.ts", fileContent);
  console.log(
    `Wrote ${models.length} models from '${gateway.type}' gateway to lib/ai/models.generated.ts`
  );
};
/* oxlint-enable no-console, no-magic-numbers, node/no-sync, typescript/strict-boolean-expressions, unicorn/no-null */

// oxlint-disable-next-line node/no-top-level-await -- This executable completes model fetching and file publication before the command finishes.
await fetchAndSaveModels();
