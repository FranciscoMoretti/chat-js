// Explicit source-clone verification profile. Run only in a disposable checkout.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const app = path.join(root, "apps/chat");
const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim();
if (bucket === undefined || bucket === "") {
  throw new Error("Set SUPABASE_STORAGE_BUCKET to an existing private bucket.");
}
await copyFile(
  path.join(root, "packages/registry/src/storage/supabase/storage-provider.ts"),
  path.join(app, "lib/storage-provider.ts")
);
await writeFile(
  path.join(app, "lib/storage-options.ts"),
  `import type { EnvRequirement } from "./config-requirements";
import type { createStorageAdapter } from "./storage-provider";
export const storageOptions = ${JSON.stringify({ bucket, public: false })} satisfies Parameters<typeof createStorageAdapter>[0];
export const storageId = "supabase";
export const storageEnvRequirements: EnvRequirement[] = [{ options: [["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]] }];
`
);
// Replace the reference app's provider-specific tests along with its adapter.
const providerTests = await readFile(
  path.join(
    root,
    "packages/registry/src/storage/supabase/storage-provider.test.ts"
  ),
  "utf-8"
);
await writeFile(
  path.join(app, "lib/storage-provider.test.ts"),
  providerTests.replace('from "bun:test"', 'from "vitest"')
);
const sandbox = `import { defineSandbox } from "eve/sandbox";
import { JustBashSandbox } from "eve/sandbox/just-bash";
const environment = JustBashSandbox.environment({ autoInstall: false });
export default defineSandbox(async () => await environment.open());
`;
for (const agent of [
  "agent",
  "agent/subagents/researchPlanner",
  "agent/subagents/researchWriter",
  "agent/subagents/researchCompressor",
  "agent/subagents/researcher",
]) {
  // All paths are fixed profile-owned files, never supplied by a request.
  // oxlint-disable-next-line eslint/no-await-in-loop -- Prepare each agent's sandbox in sequence.
  await mkdir(path.join(app, agent), { recursive: true });
  // oxlint-disable-next-line eslint/no-await-in-loop -- Prepare each agent's sandbox in sequence.
  await writeFile(path.join(app, agent, "sandbox.ts"), sandbox);
}
console.info(
  "Prepared private Supabase storage and EVE JustBash verification profile."
);
