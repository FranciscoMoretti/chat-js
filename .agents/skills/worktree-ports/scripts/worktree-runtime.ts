import { file } from "bun";

const SLOT_PATTERN = /^\d+$/;
const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const TEMPLATE_PATTERN = /\{([^}]+)\}/g;
const APP_TEMPLATE_PATTERN = /^apps\.([a-zA-Z0-9_-]+)\.(port|url)$/;
const MIN_PORT = 1024;
const MAX_PORT = 65_535;

export interface WorktreeAppConfig {
  exports?: Record<string, string>;
  offset: number;
}

export interface WorktreeEnvConfig {
  apps: Record<string, WorktreeAppConfig>;
  range: {
    base: number;
    stride: number;
  };
  slot: {
    default: number;
    env: string;
  };
  url: string;
}

export interface ResolvedWorktreeApp {
  env: Record<string, string>;
  port: number;
  url: string;
}

export interface WorktreeRuntime {
  apps: Record<string, ResolvedWorktreeApp>;
  slot: number;
}

interface TemplateContext {
  apps: Record<string, { port: number; url: string }>;
  port: number;
  slot: number;
  url?: string;
}

function assertNonNegativeInteger(value: number, label: string) {
  if (!(Number.isSafeInteger(value) && value >= 0)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
}

function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(TEMPLATE_PATTERN, (_, token: string) => {
    if (token === "slot") {
      return String(context.slot);
    }
    if (token === "port") {
      return String(context.port);
    }
    if (token === "url" && context.url) {
      return context.url;
    }

    const appMatch = APP_TEMPLATE_PATTERN.exec(token);
    if (appMatch) {
      const [, appName, property] = appMatch;
      const app = context.apps[appName];
      if (app) {
        return String(app[property as "port" | "url"]);
      }
    }

    throw new Error(`Unknown worktree template variable "${token}"`);
  });
}

function resolveSlot(
  config: WorktreeEnvConfig,
  environment: Record<string, string | undefined>
): number {
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
}

export function resolveWorktreeRuntime(
  config: WorktreeEnvConfig,
  environment: Record<string, string | undefined>
): WorktreeRuntime {
  assertNonNegativeInteger(config.range.base, "range.base");
  assertNonNegativeInteger(config.range.stride, "range.stride");
  if (config.range.stride === 0) {
    throw new Error("range.stride must be greater than zero");
  }

  const slot = resolveSlot(config, environment);
  const rangeStart = config.range.base + slot * config.range.stride;
  const apps = Object.entries(config.apps);
  if (apps.length === 0) {
    throw new Error("Worktree config requires at least one app");
  }
  const seenOffsets = new Set<number>();

  for (const [appName, app] of apps) {
    assertNonNegativeInteger(app.offset, `apps.${appName}.offset`);
    if (app.offset >= config.range.stride) {
      throw new Error(
        `App "${appName}" offset ${app.offset} must be below range.stride ${config.range.stride}`
      );
    }
    if (seenOffsets.has(app.offset)) {
      throw new Error(`App offset ${app.offset} is assigned more than once`);
    }
    seenOffsets.add(app.offset);
  }

  if (config.url.includes("{apps.")) {
    throw new Error(
      "url must not reference other apps; use cross-app templates in exports"
    );
  }

  const endpoints: Record<string, { port: number; url: string }> = {};
  for (const [appName, app] of apps) {
    const port = rangeStart + app.offset;
    if (port < MIN_PORT || port > MAX_PORT) {
      throw new Error(
        `App "${appName}" computed port ${port} is outside valid range ${MIN_PORT}-${MAX_PORT}`
      );
    }
    endpoints[appName] = {
      port,
      url: renderTemplate(config.url, {
        apps: endpoints,
        port,
        slot,
      }),
    };
  }

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

  return { apps: resolvedApps, slot };
}

export async function loadWorktreeConfig(
  path = ".worktree-env.json"
): Promise<WorktreeEnvConfig> {
  const configFile = file(path);
  if (!(await configFile.exists())) {
    throw new Error(`Missing worktree environment config: ${path}`);
  }
  return configFile.json();
}
