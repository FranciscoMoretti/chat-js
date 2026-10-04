import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { preflight } from "./preflight";

const notFound = -1;
const startOfFile = 0;

// oxlint-disable-next-line eslint/max-statements -- Preserve the owned section boundary and verify unrelated user configuration in the same ordered operation.
export const updateEnvironmentExample = async (
  cwd: string,
  section: "gateway-provider" | "storage-provider" | "installed-capabilities",
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
  const start = `# <chatjs-${section}>`;
  const end = `# </chatjs-${section}>`;
  const from = original.indexOf(start);
  const to = original.indexOf(end);
  // Each independently replaced section must retain its own shared credentials.
  // Only user-owned entries outside all managed sections can suppress duplicates.
  const preserved = original.replaceAll(
    /^# <chatjs-(?<section>gateway-provider|storage-provider|installed-capabilities)>\r?\n[\s\S]*?^# <\/chatjs-\k<section>>\r?$/gmu,
    ""
  );
  const entries = [...new Set(variables)]
    .filter((name) => !new RegExp(`^${name}=`, "mu").test(preserved))
    .map((name) => `${name}=`);
  const block = `${start}\n# Credentials for installed source. Fill applicable alternatives in .env.local.\n${entries.join("\n")}\n${end}`;
  const result =
    from !== notFound && to >= from
      ? original.slice(startOfFile, from) +
        block +
        original.slice(to + end.length)
      : `${original}\n${block}\n`;
  await writeFile(file, result);
};
