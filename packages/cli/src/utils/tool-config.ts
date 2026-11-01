import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ToolDefinition } from "../../../registry/metadata";
import type { ReadonlyInput } from "../helpers/readonly-input";
import { preflight } from "./preflight";

const planToolConfig = async (
  cwd: string,
  definitions: readonly ReadonlyInput<ToolDefinition>[]
): Promise<string> => {
  const configs = definitions.flatMap((definition) =>
    definition.config ? [{ id: definition.id, key: definition.config.key }] : []
  );
  const keys = new Set(["followupSuggestions"]);
  for (const config of configs) {
    if (keys.has(config.key)) {
      throw new Error(
        `Duplicate or reserved tool configuration key: ${config.key}`
      );
    }
    keys.add(config.key);
  }
  const targets = configs.map(
    ({ id }) => `chatjs/tools/${id}/configuration-schema.ts`
  );
  await preflight(cwd, targets);
  await Promise.all(
    targets.map(async (target): Promise<void> => {
      await readFile(path.join(cwd, target), "utf-8");
    })
  );
  return `${configs.map(({ id }, index) => `import { configSchema as config${index} } from "@/chatjs/tools/${id}/configuration-schema";`).join("\n")}\n\nexport const installedToolConfig = {\n${configs.map(({ key }, index) => `  ${key}: config${index},`).join("\n")}\n};\n`;
};
export { planToolConfig };
