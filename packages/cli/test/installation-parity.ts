import {
  isStringArray,
  parseJsonObject,
  requireJsonObject,
} from "../src/helpers/json-object";
import { expect } from "bun:test";
import { format } from "oxfmt";
import {
  readProjectFiles,
  compareProjects,
} from "@chat-js/registry-validation";
import type { ProjectFiles } from "@chat-js/registry-validation";
import { renderValidationProject } from "../../registry/scripts/validation-project";
import { scaffoldNativeProject } from "../src/helpers/native-scaffold";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
  !(file.startsWith("chatjs/") && !file.startsWith("chatjs/generated/")) &&
  // Companion contents/build are exercised by the packed desktop fixture.
  !file.startsWith("electron/") &&
  !/^(?:node_modules|\.git|\.chatjs|\.next|\.eve|\.output|lib\/db\/migrations)(?:\/|$)/u.test(
    file
  ) &&
  !/^(?:bun\.lockb?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/u.test(
    file
  ) &&
  !file.endsWith(".tsbuildinfo");

// Predict compositions on an independently initialized native shell, just as
// create does. Keep whole-tree comparison: copying the actual app's native files
// or excluding all UI files would hide accidental overwrites during add/sync.
const prepareNativeCore = async (): Promise<Map<string, Uint8Array>> => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-native-parity-"));
  try {
    await scaffoldNativeProject(directory, "bun", []);
    return await readProjectFiles(directory, comparable);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
};

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
  if (file === "tsconfig.json") {
    return parseJsonObject(source, "tsconfig.json");
  }
  if (file === "package.json" || file === "components.json") {
    return file === "package.json" ? manifest(source) : normalize(source);
  }
  if (
    /\.(?:[cm]?[jt]sx?|json|css)$/u.test(file) &&
    !file.startsWith("chatjs/generated/")
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
  fixture.core ??= await prepareNativeCore();
  const predicted = await renderValidationProject(fixture.core, selection, {
    name,
    title: name
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  });
  if (selection.plugins.includes("desktop")) {
    const bytes = predicted.files.get("tsconfig.json");
    if (!bytes) {
      throw new Error("Missing predicted tsconfig");
    }
    const config = parseJsonObject(
      new TextDecoder().decode(bytes),
      "tsconfig.json"
    );
    config.exclude = [
      ...(isStringArray(config.exclude) ? config.exclude : []),
      "electron",
    ];
    predicted.files.set(
      "tsconfig.json",
      new TextEncoder().encode(JSON.stringify(config))
    );
  }
  const actual = await readProjectFiles(cwd, comparable);
  expect(await compareInstallationProjects(predicted.files, actual)).toEqual(
    []
  );
};
