import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import path from "node:path";

import { updateEnvironmentExample } from "./environment-example";

// oxlint-disable-next-line eslint/max-statements -- Preserve the owned section boundary and verify unrelated user configuration in the same ordered operation.
test("replacement updates owned credential examples while preserving user entries and real credentials", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-env-example-"));
  const example = path.join(cwd, ".env.example");
  const local = path.join(cwd, ".env.local");
  try {
    await writeFile(
      example,
      "# My configuration\nCUSTOM=value\nFIRECRAWL_API_KEY=example-only\n"
    );
    await writeFile(local, "TAVILY_API_KEY=local-fixture\n");
    await updateEnvironmentExample(cwd, "installed-capabilities", [
      "TAVILY_API_KEY",
    ]);
    await updateEnvironmentExample(cwd, "installed-capabilities", [
      "FIRECRAWL_API_KEY",
    ]);
    const result = await readFile(example, "utf-8");
    expect(result).toStartWith(
      "# My configuration\nCUSTOM=value\nFIRECRAWL_API_KEY=example-only\n"
    );
    expect(result).not.toContain("TAVILY_API_KEY=");
    expect(await readFile(local, "utf-8")).toBe(
      "TAVILY_API_KEY=local-fixture\n"
    );
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

// oxlint-disable-next-line eslint/max-statements -- Exercise both independent provider replacements and legacy user ownership in one sequence.
test("independent provider sections retain shared credentials and preserve unmarked legacy entries", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-shared-env-"));
  const file = path.join(cwd, ".env.example");
  try {
    await writeFile(file, "OPENAI_API_KEY=legacy-example\n");
    await updateEnvironmentExample(cwd, "storage-provider", [
      "VERCEL_OIDC_TOKEN",
      "BLOB_STORE_ID",
    ]);
    await updateEnvironmentExample(cwd, "gateway-provider", [
      "VERCEL_OIDC_TOKEN",
      "AI_GATEWAY_API_KEY",
    ]);
    await updateEnvironmentExample(cwd, "storage-provider", ["AWS_REGION"]);
    expect(await readFile(file, "utf-8")).toContain("VERCEL_OIDC_TOKEN=");
    await updateEnvironmentExample(cwd, "storage-provider", [
      "VERCEL_OIDC_TOKEN",
      "BLOB_STORE_ID",
    ]);
    await updateEnvironmentExample(cwd, "gateway-provider", ["OPENAI_API_KEY"]);
    const result = await readFile(file, "utf-8");
    expect(result).toContain("VERCEL_OIDC_TOKEN=");
    expect(result).not.toContain("AI_GATEWAY_API_KEY=");
    expect(result).toStartWith("OPENAI_API_KEY=legacy-example\n");
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});
