import type { ReadonlyInput } from "./readonly-input";
import { resolveSandbox } from "#cli/registry/sandboxes";
import { planInstallation } from "#cli/utils/installation-plan";
import { SandboxRequiredError } from "#cli/utils/installation-requirements";

type Selection = Parameters<typeof planInstallation>[1];
type PlanOptions = Parameters<typeof planInstallation>[2];

// Resolve the complete tool graph before offering optional sandbox choices.
export const planSandboxInstallation = async (
  cwd: string,
  selection: ReadonlyInput<Selection>,
  options: ReadonlyInput<PlanOptions>,
  chooseSandbox: (required: boolean) => Promise<string | undefined>
) => {
  let initialPlan: Awaited<ReturnType<typeof planInstallation>> | undefined;
  try {
    initialPlan = await planInstallation(cwd, selection, options);
  } catch (error) {
    if (!(error instanceof SandboxRequiredError)) {
      throw error;
    }
  }
  const source = await chooseSandbox(initialPlan === undefined);
  const sandbox =
    typeof source === "string" && source !== ""
      ? await resolveSandbox(source, cwd)
      : undefined;
  const plan =
    sandbox || initialPlan === undefined
      ? await planInstallation(
          cwd,
          { ...selection, sandbox: sandbox?.source },
          options
        )
      : initialPlan;
  return { plan, sandbox };
};
