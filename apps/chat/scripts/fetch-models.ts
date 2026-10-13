import { getActiveGateway } from "@/lib/ai/active-gateway";
import { writeFile } from "node:fs/promises";

const EMPTY_MODEL_COUNT = 0;
const GENERATED_JSON_INDENT_SPACES = 2;

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

await fetchAndSaveModels();
