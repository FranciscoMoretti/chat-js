import type { resolveSandbox } from "#cli/registry/sandboxes";
import type { ReadonlyInput } from "./readonly-input";
import { updateEnvironmentExample } from "#cli/utils/environment-example";

/** The registry installs native agent/sandbox.ts; assembly only documents credentials. */
export const configureSandboxProvider = async (
  cwd: string,
  selection: ReadonlyInput<Awaited<ReturnType<typeof resolveSandbox>>>
): Promise<void> => {
  await updateEnvironmentExample(
    cwd,
    "sandbox-provider",
    selection.definition.envRequirements.flatMap((requirement) =>
      requirement.options.flat()
    )
  );
};
