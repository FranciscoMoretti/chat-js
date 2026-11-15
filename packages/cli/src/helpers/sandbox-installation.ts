import type { ReadonlyInput } from "./readonly-input";
import { resolveSandbox } from "#cli/registry/sandboxes";
import { planInstallation } from "#cli/utils/installation-plan";

type Selection = Parameters<typeof planInstallation>[1];
type PlanOptions = Parameters<typeof planInstallation>[2];

export const planSandboxInstallation = async (
  cwd: string,
  selection: ReadonlyInput<Selection>,
  options: ReadonlyInput<PlanOptions>,
  chooseSandbox: () => Promise<string | undefined>
) => {
  const sandbox = await resolveSandbox(
    (await chooseSandbox()) ?? "default",
    cwd
  );
  const plan = await planInstallation(
    cwd,
    { ...selection, sandbox: sandbox.source },
    options
  );
  return { plan, sandbox };
};
