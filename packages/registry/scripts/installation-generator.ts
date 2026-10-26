import { withRegistryProject } from "@chat-js/registry-validation/shadcn";
import { updateEnvironmentExample } from "../../cli/src/utils/environment-example";
import { assertItemDependencies } from "../dependency-contract";
import {
  configureSandboxProvider,
  sandboxProviderTargets,
} from "../../cli/src/helpers/sandbox-provider";
import { resolveSandbox } from "../../cli/src/registry/sandboxes";
import { readFile } from "node:fs/promises";
import {
  configureGatewayProvider,
  gatewayConfigurationTargets,
} from "../../cli/src/helpers/gateway-provider";
import {
  configureStorageProvider,
  storageConfigurationTargets,
} from "../../cli/src/helpers/storage-provider";
import type { InstallationSelection } from "../installation";
import { registryDescriptor } from "../descriptor";
import {
  syncTools,
  toolRegistrationTargets,
} from "../../cli/src/utils/sync-tools";
import {
  syncPlugins,
  pluginRegistrationTargets,
} from "../../cli/src/utils/sync-plugins";
import type { RegistryItem } from "shadcn/schema";
import path from "node:path";
import { planInstallation } from "../../cli/src/utils/installation-plan";
import { registry } from "../registry";
import { resolveGateway } from "../../cli/src/registry/gateways";
import { resolveStorage } from "../../cli/src/registry/storage";
import { incrementalPluginFiles } from "./demo-incremental";

const bootstrapPaths = [
  "components.json",
  "composer-controls.ts",
  "settings-items.ts",
  "package.json",
  "tsconfig.json",
  "app/globals.css",
  ".env.example",
];

const registryRoot = path.resolve(import.meta.dir, "..");

const demoRoot = path.resolve(registryRoot, "../../apps/chat");

// Drain sibling formatter work before cleanup or process exit after one failure.
// Native formatter callbacks can otherwise still be pending during teardown.
const settleGeneration = async <Value>(
  pending: readonly Promise<Value>[]
): Promise<Value[]> => {
  const results = await Promise.allSettled(pending);
  const values: Value[] = [];
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
    values.push(result.value);
  }
  return values;
};

const captureRegistry = async () =>
  await settleGeneration(
    registry.items.map(async (item) => {
      const files = await Promise.all(
        (item.files ?? []).map(async (file) => ({
          ...file,
          content: await readFile(path.join(registryRoot, file.path), "utf-8"),
        }))
      );
      assertItemDependencies(
        item,
        new Map(files.map((file) => [file.path, file.content]))
      );
      const descriptor = await registryDescriptor(item);
      if (descriptor) {
        files.push({ ...descriptor, content: descriptor.content ?? "" });
      }
      return { ...item, files };
    })
  );

const resolveProviders = async (
  selection: InstallationSelection,
  directory: string
) => {
  const { gateway, storage, sandbox } = selection;
  if (gateway === undefined || gateway === "" || storage === undefined) {
    throw new Error("Installation requires gateway and storage selections");
  }
  return {
    gateway: await resolveGateway(gateway, directory),
    storage: {
      ...(await resolveStorage(storage.source, directory)),
      options: storage.options,
    },
    sandbox:
      typeof sandbox === "string" && sandbox !== ""
        ? await resolveSandbox(sandbox, directory)
        : undefined,
  };
};

const configureInstallation = async (
  directory: string,
  providers: Awaited<ReturnType<typeof resolveProviders>>,
  plan: Awaited<ReturnType<typeof planInstallation>>,
  addUi: boolean
): Promise<void> => {
  if (providers.sandbox) {
    await configureSandboxProvider(directory, providers.sandbox);
  }
  await configureGatewayProvider(directory, providers.gateway);
  await configureStorageProvider(directory, providers.storage);
  await syncTools(directory, { expected: plan.expected });
  // The mirror preserves app-owned order; consumer validation supplies its core UI.
  await syncPlugins(directory, {
    expected: plan.plugins.map((plugin) => plugin.id),
    addUi,
  });
  await updateEnvironmentExample(
    directory,
    "installed-capabilities",
    plan.environmentVariables
  );
};

/** ChatJS assembly is shared by the mirror and consumer validator. */
const generateInstallation = async (
  selection: InstallationSelection,
  options: Readonly<{
    projectFiles?: ReadonlyMap<string, Uint8Array>;
    changes?: readonly string[];
    previous?: Readonly<Record<string, string>>;
    pluginUi?: Readonly<
      Record<"composer-controls.ts" | "settings-items.ts", string>
    >;
  }> = {}
): Promise<{
  files: Map<string, string>;
  ownedPaths: readonly string[];
  items: RegistryItem[];
  timings: Record<string, number>;
}> => {
  const timings: Record<string, number> = {};
  const beforeCapture = performance.now();
  const items = await captureRegistry();
  timings.captureMs = performance.now() - beforeCapture;
  const encoder = new TextEncoder();
  const projectFiles = new Map([
    ["components.json", await readFile(path.join(demoRoot, "components.json"))],
    ["package.json", encoder.encode('{"name":"demo-sync","dependencies":{}}')],
    [
      "tsconfig.json",
      encoder.encode(
        '{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}'
      ),
    ],
    ["app/globals.css", encoder.encode('@import "tailwindcss";')],
    ...(options.projectFiles ?? []),
    ...Object.entries(options.pluginUi ?? {}).map(
      ([file, source]) => [file, encoder.encode(source)] as const
    ),
  ]);
  const staged = await withRegistryProject(
    {
      namespace: "@chatjs",
      items,
      files: projectFiles,
      protectedPaths: bootstrapPaths,
    },
    async (project) => {
      const { directory } = project;
      const beforePlan = performance.now();
      const plan = await planInstallation(directory, selection, {
        fresh: true,
      });
      const incrementalFiles = await incrementalPluginFiles({
        changes: options.changes,
        previous: options.previous,
        items: plan.items,
        registryRoot,
      });
      const incrementalItem: RegistryItem | undefined = incrementalFiles
        ? {
            name: "demo-incremental",
            type: "registry:item",
            files: incrementalFiles,
            dependencies: [],
            devDependencies: [],
          }
        : undefined;
      timings.planMs = performance.now() - beforePlan;
      await project.install(
        incrementalItem ? ["@chatjs/demo-incremental"] : plan.sources,
        incrementalItem ? [incrementalItem] : []
      );
      const beforeConfigure = performance.now();
      const providers = await resolveProviders(selection, directory);
      if (!incrementalItem) {
        await configureInstallation(
          directory,
          providers,
          plan,
          options.pluginUi !== undefined
        );
      }
      timings.configureMs = performance.now() - beforeConfigure;
      const seedFiles = options.pluginUi ?? {};
      const excluded = new Set(bootstrapPaths);
      if (options.projectFiles) {
        excluded.delete(".env.example");
      }
      for (const file of Object.keys(seedFiles)) {
        excluded.delete(file);
      }
      const ownedPaths = [
        ...plan.items.flatMap((item) =>
          (item.files ?? []).map((file) => {
            if (file.target?.startsWith("~/") !== true) {
              throw new Error(
                `Expected explicit app-relative target: ${file.path}`
              );
            }
            return file.target.slice(2);
          })
        ),
        ...Object.keys(seedFiles),
        ...toolRegistrationTargets,
        ...pluginRegistrationTargets,
        ...gatewayConfigurationTargets,
        ...storageConfigurationTargets,
        ...sandboxProviderTargets(providers.sandbox),
      ].filter((file) => !excluded.has(file));
      const allowed = new Set(ownedPaths);
      const installedFiles = await project.readFiles();
      const copies = [...installedFiles]
        .filter(
          ([file]) =>
            !excluded.has(file) &&
            (allowed.has(file) || options.projectFiles?.has(file) !== true)
        )
        .map(
          ([file, content]) =>
            [file, new TextDecoder().decode(content)] as const
        );
      const output = new Map(
        incrementalItem ? Object.entries(options.previous ?? {}) : []
      );
      for (const [file, content] of copies) {
        output.set(file, content);
      }
      if (options.changes) {
        console.info(
          `[registry-mirror] ${incrementalItem ? "Incremental plugin" : "Full"} generation (${copies.length} outputs)`
        );
      }
      for (const file of output.keys()) {
        if (!allowed.has(file)) {
          throw new Error(`Undeclared installation output: ${file}`);
        }
      }
      const captured = plan.items.map((item) => {
        const original = items.find(
          (candidate) => candidate.name === item.name
        );
        if (!original) {
          throw new Error(`Uncaptured registry item: ${item.name}`);
        }
        return original;
      });
      return { files: output, ownedPaths, items: captured };
    }
  );
  return { ...staged.result, timings: { ...timings, ...staged.timings } };
};
export { generateInstallation };
