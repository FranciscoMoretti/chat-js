import { getMissingRequirement } from "./config-requirements";
import type { EnvRequirement } from "./config-requirements";

export interface ToolRequirements {
  readonly id: string;
  readonly envRequirements: readonly EnvRequirement[];
  readonly requiresTools: readonly string[];
  readonly requiresGateway: boolean;
  readonly requiresStorage: boolean;
}

/** Configuration presence only. No credential values, network requests, or connection claims. */
export const inspectToolConfiguration = (
  name: string,
  tools: Readonly<Partial<Record<string, ToolRequirements>>>,
  providers: Readonly<Record<"gateway" | "storage", readonly EnvRequirement[]>>,
  environment: Readonly<NodeJS.ProcessEnv>
): string[] => {
  const visiting = new Set<string>();
  const inspect = (key: string): string[] => {
    const definition = tools[key];
    if (!definition) {
      return [`Required capability ${key} is not installed.`];
    }
    if (visiting.has(key)) {
      return [`Capability dependency cycle at ${key}.`];
    }
    visiting.add(key);
    const requirements = [
      ...definition.envRequirements,
      ...(definition.requiresGateway ? providers.gateway : []),
      ...(definition.requiresStorage ? providers.storage : []),
    ];
    const missing = requirements.flatMap((requirement) => {
      const message = getMissingRequirement(requirement, environment);
      return message === null ? [] : [`${definition.id}: ${message}`];
    });
    const dependencies = definition.requiresTools.flatMap(inspect);
    visiting.delete(key);
    return [...missing, ...dependencies];
  };
  return [...new Set(inspect(name))];
};
