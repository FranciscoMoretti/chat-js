import { chatjsEveRegistry } from "../../../registry/chatjs-capabilities";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  eveCompositionIssue,
  eveItemIdSchema,
} from "../../../registry/eve-catalog";
import type { PackageManager } from "#cli/types";
import { optionalDirectoryFiles } from "#cli/utils/installation-files";
import { runCommand } from "#cli/utils/run-command";

const safePath = (file: string): boolean =>
  !file
    .split("/")
    .some(
      (part) =>
        part === ".." || part === "." || part === "" || part.startsWith(".env")
    ) && /^agent\/[a-zA-Z0-9_./-]+$/u.test(file);
export const eveSourceSchema = z.array(
  z.strictObject({
    path: z
      .string()
      .refine(
        (file) => file === ".env.example" || safePath(file),
        "Invalid EVE source path"
      ),
    content: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  })
);
export type EveSources = z.infer<typeof eveSourceSchema>;
const shellArgument = (value: string): string =>
  /^[a-zA-Z0-9_@/.-]+$/u.test(value)
    ? value
    : `'${value.replaceAll("'", "'\"'\"'")}'`;
const digest = (content: string): string =>
  createHash("sha256").update(content).digest("hex");

export const validateEveSources = (input: unknown): EveSources => {
  const sources = eveSourceSchema.parse(input);
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.path) || digest(source.content) !== source.sha256) {
      throw new Error(`EVE source changed or duplicated: ${source.path}.`);
    }
    seen.add(source.path);
  }
  return sources;
};

export const eveInstallArguments = (id: string): string[] => {
  eveItemIdSchema.parse(id);
  const issue = eveCompositionIssue(id);
  if (issue !== undefined) {
    throw new Error(issue);
  }
  return ["eve", "add", id, "--skip-setup", "--non-interactive"];
};

/** EVE owns installation. Capture generated public source for offline recipe replay. */
export const installEveIntegrations = async (
  cwd: string,
  items: readonly string[],
  packageManager: PackageManager,
  recorded?: EveSources,
  registries: Readonly<Record<string, string>> = {}
): Promise<EveSources> => {
  if (items.length === 0) {
    return [];
  }
  const commands = items.map(eveInstallArguments);
  let sources: EveSources;
  if (recorded) {
    sources = validateEveSources(recorded);
    if (sources.length === 0) {
      throw new Error("Recipe is missing its installed EVE source.");
    }
    await Promise.all(
      sources.map(async (source) => {
        const target = path.join(cwd, source.path);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, source.content);
      })
    );
  } else {
    const prefixes: Record<PackageManager, string[]> = {
      npm: ["exec", "--"],
      pnpm: ["exec"],
      bun: ["run"],
      yarn: ["run"],
    };
    const prefix = prefixes[packageManager];
    const namespaces = new Set(
      items.filter((id) => id.startsWith("@")).map((id) => id.split("/")[0])
    );
    const templates = {
      ...registries,
      "@chatjs": process.env.CHATJS_EVE_REGISTRY_URL ?? chatjsEveRegistry,
    };
    for (const [namespace, template] of Object.entries(templates)) {
      if (namespaces.has(namespace)) {
        // eslint-disable-next-line no-await-in-loop -- Configure namespaces before installing their items.
        await runCommand(
          packageManager,
          [...prefix, "eve", "registry", "add", `${namespace}=${template}`],
          cwd,
          "inherit"
        );
      }
    }
    // Install sequentially: each native operation changes the same package and agent.
    for (const args of commands) {
      // eslint-disable-next-line no-await-in-loop -- Native installers mutate shared project files.
      await runCommand(packageManager, [...prefix, ...args], cwd, "inherit");
    }
    const files = [
      ...(await optionalDirectoryFiles(cwd, "agent")),
      ".env.example",
    ].toSorted();
    sources = await Promise.all(
      files.map(async (file) => {
        const content = await readFile(path.join(cwd, file), "utf-8");
        return { path: file, content, sha256: digest(content) };
      })
    );
    validateEveSources(sources);
  }
  await mkdir(path.join(cwd, "chatjs"), { recursive: true });
  await writeFile(
    path.join(cwd, "chatjs/eve-setup.md"),
    [
      "# EVE capability setup",
      "",
      "EVE installed the selected registry items without running provider setup. Some integrations, including Slack, create their agent files during setup.",
      "",
      "Review each integration’s documentation, then complete its native setup where provided:",
      "",
      ...items.map((id) => `- \`eve add ${shellArgument(id)} --skip-install\``),
      "",
      "Some capabilities only require configuring their generated files or environment variables. EVE reports any required accounts, consent, infrastructure, or runtime version.",
      "",
      "Native memory follows its provider’s retention policy. ChatJS conversation deletion does not automatically erase external memory.",
      "",
    ].join("\n")
  );
  return sources;
};
