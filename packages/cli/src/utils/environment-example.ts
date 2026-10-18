import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { preflight } from "./preflight";

const notFound = -1;
const startOfFile = 0;

const replaceEnvironmentSection = (
  original: string,
  section:
    | "gateway-provider"
    | "storage-provider"
    | "sandbox-provider"
    | "installed-capabilities",
  variables: readonly string[]
): string => {
  const start = `# <chatjs-${section}>`;
  const end = `# </chatjs-${section}>`;
  const from = original.indexOf(start);
  const to = original.indexOf(end);
  // Each independently replaced section must retain its own shared credentials.
  // Only user-owned entries outside all managed sections can suppress duplicates.
  const preserved = original.replaceAll(
    /^# <chatjs-(?<section>gateway-provider|storage-provider|sandbox-provider|installed-capabilities)>\r?\n[\s\S]*?^# <\/chatjs-\k<section>>\r?$/gmu,
    ""
  );
  const entries = [...new Set(variables)]
    .filter((name) => !new RegExp(`^${name}=`, "mu").test(preserved))
    .map((name) => `${name}=`);
  const block = `${start}\n# Credentials for installed source. Fill applicable alternatives in .env.local.\n${entries.join("\n")}\n${end}`;
  if (from !== notFound && to >= from) {
    return (
      original.slice(startOfFile, from) +
      block +
      original.slice(to + end.length)
    );
  }
  return `${original}\n${block}\n`;
};

export const updateEnvironmentExample = async (
  cwd: string,
  section:
    | "gateway-provider"
    | "storage-provider"
    | "sandbox-provider"
    | "installed-capabilities",
  variables: readonly string[]
): Promise<void> => {
  await preflight(cwd, [".env.example"]);
  const file = path.join(cwd, ".env.example");
  const original = await readFile(file, "utf-8").catch((error: unknown) => {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "";
    }
    throw error;
  });
  await writeFile(
    file,
    replaceEnvironmentSection(original, section, variables)
  );
};
