import type { InstallationSelection } from "../../../registry/installation";
import type { StorageSelection } from "#cli/registry/storage";
import type { ReadonlyInput } from "./readonly-input";
import { resolveSandbox } from "#cli/registry/sandboxes";
import { planInstallationWithStorage } from "#cli/utils/installation-plan";

export const planInteractiveInstallation = async (
  cwd: string,
  selection: ReadonlyInput<Omit<InstallationSelection, "storage" | "sandbox">>,
  chooseSandbox: () => Promise<string | undefined>,
  chooseStorage: (requiresStorage: boolean) => Promise<StorageSelection>
) => {
  const sandbox = await resolveSandbox(
    (await chooseSandbox()) ?? "default",
    cwd
  );
  const { plan, storage } = await planInstallationWithStorage(
    cwd,
    { ...selection, sandbox: sandbox.source },
    { fresh: true, requireToolKind: true },
    chooseStorage
  );
  return { plan, sandbox, storage };
};
