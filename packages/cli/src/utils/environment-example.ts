// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI reads, writes, and validates real project files with native filesystem APIs.
import { readFile, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Node/Bun CLI resolves platform-specific project and installation paths.
import path from "node:path";

import { preflight } from "./preflight";

const notFound = -1;
const startOfFile = 0;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (updateEnvironmentExample); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve updateEnvironmentExample's awaited sequencing and rejected-Promise behavior. */
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
  if (from !== notFound && to >= from) {
    await writeFile(
      file,
      original.slice(startOfFile, from) +
        block +
        original.slice(to + end.length)
    );
    return;
  }
  await writeFile(file, `${original}\n${block}\n`);
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
