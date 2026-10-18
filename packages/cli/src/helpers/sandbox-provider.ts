import { preflight } from "#cli/utils/preflight";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { resolveSandbox } from "#cli/registry/sandboxes";
import type { ReadonlyInput } from "./readonly-input";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
import { updateEnvironmentExample } from "#cli/utils/environment-example";

export const configureSandboxProvider = async (
  cwd: string,
  selection: ReadonlyInput<Awaited<ReturnType<typeof resolveSandbox>>>
): Promise<void> => {
  await preflight(cwd, ["lib/sandbox/options.ts", ".env.example"]);
  await writeFile(
    path.join(cwd, "lib/sandbox/options.ts"),
    generatedRegistrationSource(`import type { EnvRequirement } from "@/lib/config-requirements";

export const sandboxId = ${JSON.stringify(selection.definition.id)};
export const sandboxEnvRequirements: EnvRequirement[] = ${JSON.stringify(selection.definition.envRequirements)};
`)
  );
  await updateEnvironmentExample(
    cwd,
    "sandbox-provider",
    selection.definition.envRequirements.flatMap((requirement) =>
      requirement.options.flat()
    )
  );
};
