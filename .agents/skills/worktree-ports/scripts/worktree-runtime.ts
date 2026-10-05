import type { WorktreeAppConfig, WorktreeEnvConfig } from "./worktree-config";

const SLOT_PATTERN = /^\d+$/u;
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u;
const TEMPLATE_PATTERN = /\{(?<token>[^}]+)\}/gu;
const APP_TEMPLATE_PATTERN =
  /^apps\.(?<app>[a-zA-Z0-9_-]+)\.(?<property>port|url)$/u;
const NON_NEGATIVE_MINIMUM = 0;
const EMPTY_RANGE_STRIDE = 0;
const NO_CONFIGURED_APPS = 0;
const EMPTY_URL_LENGTH = 0;
const TEMPLATE_WRAPPER_WIDTH = 1;
const MIN_PORT = 1024;
const MAX_PORT = 65_535;

interface ResolvedWorktreeApp {
  readonly env: Record<string, string>;
  readonly port: number;
  readonly url: string;
}

interface WorktreeRuntime {
  readonly apps: Record<string, ResolvedWorktreeApp>;
  readonly slot: number;
}

interface TemplateContext {
  readonly apps: Readonly<
    Record<string, Readonly<{ port: number; url: string }>>
  >;
  readonly port: number;
  readonly slot: number;
  readonly url?: string;
}

const assertNonNegativeInteger = (value: number, label: string): void => {
  if (!(Number.isSafeInteger(value) && value >= NON_NEGATIVE_MINIMUM)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
};

const unknownTemplateVariable = (token: string): never => {
  throw new Error(`Unknown worktree template variable "${token}"`);
};

const resolveAppTemplateToken = (
  token: string,
  context: Readonly<TemplateContext>
): string => {
  const appMatch = APP_TEMPLATE_PATTERN.exec(token);
  if (!appMatch) {
    return unknownTemplateVariable(token);
  }
  const [, appName, property] = appMatch;
  const app = context.apps[appName];
  if (Boolean(app) && (property === "port" || property === "url")) {
    return String(app[property]);
  }
  return unknownTemplateVariable(token);
};

const resolveTemplateToken = (
  token: string,
  context: Readonly<TemplateContext>
): string => {
  if (token === "slot") {
    return String(context.slot);
  }
  if (token === "port") {
    return String(context.port);
  }
  if (
    token === "url" &&
    typeof context.url === "string" &&
    context.url.length > EMPTY_URL_LENGTH
  ) {
    return context.url;
  }

  return resolveAppTemplateToken(token, context);
};

const renderTemplate = (
  template: string,
  context: Readonly<TemplateContext>
): string =>
  template.replace(TEMPLATE_PATTERN, (wrappedToken) =>
    resolveTemplateToken(
      wrappedToken.slice(TEMPLATE_WRAPPER_WIDTH, -TEMPLATE_WRAPPER_WIDTH),
      context
    )
  );
const resolveSlot = (
  config: Readonly<WorktreeEnvConfig>,
  environment: Readonly<Record<string, string | undefined>>
): number => {
  if (!ENV_NAME_PATTERN.test(config.slot.env)) {
    throw new Error(`Invalid slot.env "${config.slot.env}"`);
  }
  assertNonNegativeInteger(config.slot.default, "slot.default");
  const rawSlot = environment[config.slot.env] ?? String(config.slot.default);

  if (!SLOT_PATTERN.test(rawSlot)) {
    throw new Error(
      `Invalid ${config.slot.env} "${rawSlot}": expected a non-negative integer`
    );
  }

  const slot = Number(rawSlot);
  assertNonNegativeInteger(slot, config.slot.env);
  return slot;
};

type AppEntries = readonly (readonly [string, WorktreeAppConfig])[];
type AppEndpoints = Readonly<
  Record<string, Readonly<{ port: number; url: string }>>
>;
type MutableAppEndpoints = Record<string, { port: number; url: string }>;
type EndpointResolution = Readonly<{
  apps: AppEntries;
  rangeStart: number;
  template: string;
  slot: number;
}>;
type RuntimeStart = Readonly<{ rangeStart: number; slot: number }>;

const validateAppOffsets = (apps: AppEntries, stride: number): void => {
  const seenOffsets = new Set<number>();
  for (const [appName, app] of apps) {
    assertNonNegativeInteger(app.offset, `apps.${appName}.offset`);
    if (app.offset >= stride) {
      throw new Error(
        `App "${appName}" offset ${app.offset} must be below range.stride ${stride}`
      );
    }
    if (seenOffsets.has(app.offset)) {
      throw new Error(`App offset ${app.offset} is assigned more than once`);
    }
    seenOffsets.add(app.offset);
  }
};

const resolveAppEndpoints = ({
  apps,
  rangeStart,
  template,
  slot,
}: EndpointResolution): AppEndpoints => {
  const endpoints: MutableAppEndpoints = {};
  for (const [appName, app] of apps) {
    const port = rangeStart + app.offset;
    if (port < MIN_PORT || port > MAX_PORT) {
      throw new Error(
        `App "${appName}" computed port ${port} is outside valid range ${MIN_PORT}-${MAX_PORT}`
      );
    }
    endpoints[appName] = {
      port,
      url: renderTemplate(template, {
        apps: endpoints,
        port,
        slot,
      }),
    };
  }
  return endpoints;
};

const resolveAppEnvironments = (
  options: Readonly<{
    apps: AppEntries;
    endpoints: AppEndpoints;
    slot: number;
  }>
): Record<string, ResolvedWorktreeApp> => {
  const { apps, endpoints, slot } = options;
  const resolvedApps: Record<string, ResolvedWorktreeApp> = {};
  for (const [appName, app] of apps) {
    const endpoint = endpoints[appName];
    const env: Record<string, string> = {};
    for (const [name, template] of Object.entries(app.exports ?? {})) {
      env[name] = renderTemplate(template, {
        apps: endpoints,
        port: endpoint.port,
        slot,
        url: endpoint.url,
      });
    }
    resolvedApps[appName] = { ...endpoint, env };
  }
  return resolvedApps;
};

const resolveRuntimeStart = (
  config: Readonly<WorktreeEnvConfig>,
  environment: Readonly<Record<string, string | undefined>>
): RuntimeStart => {
  assertNonNegativeInteger(config.range.base, "range.base");
  assertNonNegativeInteger(config.range.stride, "range.stride");
  if (config.range.stride === EMPTY_RANGE_STRIDE) {
    throw new Error("range.stride must be greater than zero");
  }
  const slot = resolveSlot(config, environment);
  return { rangeStart: config.range.base + slot * config.range.stride, slot };
};

const resolveWorktreeRuntime = (
  config: Readonly<WorktreeEnvConfig>,
  environment: Readonly<Record<string, string | undefined>>
): WorktreeRuntime => {
  const { rangeStart, slot } = resolveRuntimeStart(config, environment);
  const apps = Object.entries(config.apps);
  if (apps.length === NO_CONFIGURED_APPS) {
    throw new Error("Worktree config requires at least one app");
  }
  validateAppOffsets(apps, config.range.stride);

  if (config.url.includes("{apps.")) {
    throw new Error(
      "url must not reference other apps; use cross-app templates in exports"
    );
  }

  const endpoints = resolveAppEndpoints({
    apps,
    rangeStart,
    slot,
    template: config.url,
  });
  return {
    apps: resolveAppEnvironments({ apps, endpoints, slot }),
    slot,
  };
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (loadWorktreeConfig); the enabled import/no-default-export convention rejects the default-export alternative. */
export { loadWorktreeConfig } from "./worktree-config";
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (resolveWorktreeRuntime); the enabled import/no-default-export convention rejects the default-export alternative. */
export { resolveWorktreeRuntime };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ResolvedWorktreeApp, WorktreeRuntime); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ResolvedWorktreeApp, WorktreeRuntime };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (WorktreeAppConfig, WorktreeEnvConfig); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { WorktreeAppConfig, WorktreeEnvConfig } from "./worktree-config";
/* oxlint-enable import/no-named-export */
