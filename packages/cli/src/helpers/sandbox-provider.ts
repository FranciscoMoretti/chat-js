import { preflight } from "#cli/utils/preflight";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { resolveSandbox } from "#cli/registry/sandboxes";
import type { ReadonlyInput } from "./readonly-input";
import { generatedRegistrationSource } from "#cli/utils/generated-registration-source";
import { updateEnvironmentExample } from "#cli/utils/environment-example";

export const sandboxProviderTargets = (
  selection:
    | ReadonlyInput<Awaited<ReturnType<typeof resolveSandbox>>>
    | undefined
): string[] => {
  if (!selection) {
    return [];
  }
  return [
    "chatjs/providers/sandbox/options.ts",
    ...(selection.definition.id === "daytona"
      ? ["chatjs/providers/sandbox/persistent.ts"]
      : []),
  ];
};

export const configureSandboxProvider = async (
  cwd: string,
  selection: ReadonlyInput<Awaited<ReturnType<typeof resolveSandbox>>>
): Promise<void> => {
  await preflight(cwd, [...sandboxProviderTargets(selection), ".env.example"]);
  await mkdir(path.join(cwd, "chatjs/providers/sandbox"), { recursive: true });
  if (selection.definition.id === "daytona") {
    await rm(path.join(cwd, "chatjs/providers/sandbox/persistent.ts"), {
      force: true,
    });
  }
  await writeFile(
    path.join(cwd, "chatjs/providers/sandbox/options.ts"),
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
