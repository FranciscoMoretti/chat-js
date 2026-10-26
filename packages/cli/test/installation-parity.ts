import { parseJsonObject, requireJsonObject } from "../src/helpers/json-object";
import { expect } from "bun:test";
import { format } from "oxfmt";
import {
  readProjectFiles,
  compareProjects,
} from "@chat-js/registry-validation";
import type { ProjectFiles } from "@chat-js/registry-validation";
import {
  prepareValidationCore,
  renderValidationProject,
} from "../../registry/scripts/validation-project";
import type { InstallationSelection } from "../../registry/installation";
import { parsePackageJson } from "../src/helpers/package-manifest";
import gatewayPackage from "@chat-js/gateways/package.json";
import sandboxPackage from "@chat-js/sandboxes/package.json";
import formatConfig from "../../../apps/chat/oxfmt.config";

const fixture: { core?: Map<string, Uint8Array> } = {};
// Installation bookkeeping, package-manager products and timestamped migration history
// are independently exercised by their existing integration checks.
const comparable = (file: string): boolean =>
  file !== "next-env.d.ts" &&
  !/^(?:node_modules|\.git|\.chatjs|\.next|\.eve|\.output|lib\/db\/migrations)(?:\/|$)/u.test(
    file
  ) &&
  !/^(?:bun\.lockb?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/u.test(
    file
  ) &&
  !file.endsWith(".tsbuildinfo");

const normalize = (source: string) => {
  const value = parseJsonObject(source, "components.json");
  const registries = requireJsonObject(
    value.registries ?? {},
    "component registries"
  );
  delete registries["@chatjs"];
  value.registries = registries;
  return value;
};

const manifest = (source: string) => {
  const parsed = parsePackageJson(source);
  for (const group of [parsed.dependencies, parsed.devDependencies]) {
    if (!group) {
      continue;
    }
    for (const pkg of [gatewayPackage, sandboxPackage]) {
      if (group[pkg.name]?.startsWith("http://127.0.0.1:")) {
        group[pkg.name] = pkg.version;
      }
    }
  }
  return parsed;
};

const normalizeFile = async (
  file: string,
  bytes: Uint8Array
): Promise<unknown> => {
  const source = new TextDecoder().decode(bytes);
  const encoder = new TextEncoder();
  if (file === "package.json" || file === "components.json") {
    return file === "package.json" ? manifest(source) : normalize(source);
  }
  if (
    /\.(?:[cm]?[jt]sx?|json|css)$/u.test(file) &&
    !file.startsWith("composition/generated/")
  ) {
    const result = await format(file, source, formatConfig);
    if (result.errors.length > 0) {
      throw new Error(`Cannot format parity input: ${file}`);
    }
    return encoder.encode(result.code);
  }
  return bytes;
};

export const compareInstallationProjects = async (
  expected: ProjectFiles,
  actual: ProjectFiles
) =>
  await compareProjects(expected, actual, {
    include: comparable,
    normalize: normalizeFile,
  });

export const verifyInstallationParity = async (
  cwd: string,
  selection: InstallationSelection,
  name: string
): Promise<void> => {
  fixture.core ??= await prepareValidationCore();
  const predicted = await renderValidationProject(fixture.core, selection, {
    name,
    title: name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  });
  const actual = await readProjectFiles(cwd, comparable);
  expect(await compareInstallationProjects(predicted.files, actual)).toEqual(
    []
  );
};
