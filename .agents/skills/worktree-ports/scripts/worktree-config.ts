import { file } from "bun";

interface WorktreeAppConfig {
  readonly exports?: Readonly<Record<string, string>>;
  readonly offset: number;
}

interface WorktreeEnvConfig {
  readonly apps: Readonly<Record<string, WorktreeAppConfig>>;
  readonly range: Readonly<{
    base: number;
    stride: number;
  }>;
  readonly slot: Readonly<{
    default: number;
    env: string;
  }>;
  readonly url: string;
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isStringRecord = (
  value: unknown
): value is Readonly<Record<string, string>> =>
  isRecord(value) &&
  Object.values(value).every((item) => typeof item === "string");

const isWorktreeAppConfig = (value: unknown): value is WorktreeAppConfig =>
  isRecord(value) &&
  typeof value.offset === "number" &&
  (!("exports" in value) || isStringRecord(value.exports));

const isWorktreeEnvConfig = (value: unknown): value is WorktreeEnvConfig => {
  if (!isRecord(value)) {
    return false;
  }
  const { apps, range, slot, url } = value;
  return (
    isRecord(apps) &&
    Object.values(apps).every((app) => isWorktreeAppConfig(app)) &&
    isRecord(range) &&
    typeof range.base === "number" &&
    typeof range.stride === "number" &&
    isRecord(slot) &&
    typeof slot.default === "number" &&
    typeof slot.env === "string" &&
    typeof url === "string"
  );
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve loadWorktreeConfig's awaited sequencing and rejected-Promise behavior. */
const loadWorktreeConfig = async (
  path = ".worktree-env.json"
): Promise<WorktreeEnvConfig> => {
  const configFile = file(path);
  if (!(await configFile.exists())) {
    throw new Error(`Missing worktree environment config: ${path}`);
  }
  const parsedConfig: unknown = await configFile.json();
  if (!isWorktreeEnvConfig(parsedConfig)) {
    throw new TypeError(`Invalid worktree environment config: ${path}`);
  }
  return parsedConfig;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (isWorktreeEnvConfig, loadWorktreeConfig); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { isWorktreeEnvConfig, loadWorktreeConfig };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (WorktreeAppConfig, WorktreeEnvConfig); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { WorktreeAppConfig, WorktreeEnvConfig };
/* oxlint-enable import/no-named-export */
