import {
  AUTHENTICATION_DEFAULTS,
  FEATURES_DEFAULTS,
} from "../../../apps/chat/lib/config-schema";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { scaffoldFromTemplate } from "../../cli/src/helpers/scaffold";
import { buildConfigTs } from "../../cli/src/helpers/config-builder";
import { parsePackageJson } from "../../cli/src/helpers/package-manifest";
import { readProjectFiles } from "@chat-js/registry-validation";
import type { CoreFeatureKey } from "../../cli/src/types";
import { gatewayDefinitionSchema } from "@chat-js/gateways/definition";
import type { InstallationSelection } from "../installation";
import { generateInstallation } from "./installation-generator";

// Explicit fixture roots support both hoisted and isolated workspace installs.
// The virtual consumer manifest still controls which dependencies are visible.
export const validationDependencyFixtures = [
  path.resolve(import.meta.dir, "../../../apps/chat"),
  path.resolve(import.meta.dir, ".."),
];

/** Prepare the real CLI core once, independently of the combination matrix. */
export const prepareValidationCore = async (): Promise<
  Map<string, Uint8Array>
> => {
  const temporary = await mkdtemp(
    path.join(tmpdir(), "chatjs-validation-core-")
  );
  try {
    await scaffoldFromTemplate(temporary);
    return await readProjectFiles(temporary);
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
};

const defaultIdentity = { name: "validation-app", title: "Validation App" };

/** No validation-specific plugin file or registration inventory. */
export const renderValidationProject = async (
  core: ReadonlyMap<string, Uint8Array>,
  selection: InstallationSelection,
  identity = defaultIdentity
) => {
  const coreSource = (file: string): string => {
    const source = core.get(file);
    if (!source) {
      throw new Error(`Missing core source: ${file}`);
    }
    return new TextDecoder().decode(source);
  };
  const installation = await generateInstallation(selection, {
    projectFiles: core,
    pluginUi: {
      "composer-controls.ts": coreSource("composer-controls.ts"),
      "settings-items.ts": coreSource("settings-items.ts"),
    },
  });
  const files = new Map(core);
  const put = (file: string, source: string): void => {
    files.set(file, new TextEncoder().encode(source));
  };
  for (const [file, content] of installation.files) {
    put(file, content);
  }
  const gateway = gatewayDefinitionSchema.parse(
    installation.items.find(
      (item) => gatewayDefinitionSchema.safeParse(item.meta?.chatjs).success
    )?.meta?.chatjs
  );
  const coreFeatures: Record<CoreFeatureKey, boolean> = {
    attachments: false,
    documents: false,
    mcp: false,
    projects: false,
    feedback: false,
    followupSuggestions: false,
    parallelResponses: FEATURES_DEFAULTS.parallelResponses,
  };
  put(
    "chat.config.ts",
    buildConfigTs({
      appName: identity.title,
      appPrefix: identity.name,
      appUrl: "http://localhost:3000",
      withElectron: false,
      gateway: gateway.id,
      gatewayDefaults: gateway.defaults,
      coreFeatures,
      auth: AUTHENTICATION_DEFAULTS,
    })
  );
  const manifest = parsePackageJson(
    new TextDecoder().decode(files.get("package.json"))
  );
  const dependencies = { ...manifest.dependencies };
  const devDependencies = { ...manifest.devDependencies };
  const declared = new Map<string, string>();
  for (const item of installation.items) {
    for (const [specs, target] of [
      [item.dependencies ?? [], dependencies],
      [item.devDependencies ?? [], devDependencies],
    ] as const) {
      for (const spec of specs) {
        const separator = spec.indexOf("@", 1);
        const name = separator === -1 ? spec : spec.slice(0, separator);
        const version =
          separator === -1
            ? (dependencies[name] ?? devDependencies[name])
            : spec.slice(separator + 1);
        if (!version) {
          throw new Error(
            `Cannot validate unversioned new dependency: ${spec}`
          );
        }
        const previous = declared.get(name);
        if (previous !== undefined && previous !== version) {
          throw new Error(
            `Conflicting dependency declarations for ${name}: ${previous}, ${version}`
          );
        }
        declared.set(name, version);
        target[name] = version;
      }
    }
  }
  put(
    "package.json",
    JSON.stringify(
      { ...manifest, name: identity.name, dependencies, devDependencies },
      null,
      2
    )
  );
  return { ...installation, files };
};
