import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
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
