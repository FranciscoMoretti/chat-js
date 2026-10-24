import { rejects } from "node:assert/strict";
import { z } from "zod";
import { afterEach, expect, test } from "bun:test";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { mcpDefinition } from "../../../registry/src/features/mcp";
import { generateBaseline } from "./generate-baseline";
import { planDatabaseSchemas } from "./sync-database";
import { runCommand } from "./run-command";

const roots: string[] = [];
const demo = path.resolve(import.meta.dir, "../../../../apps/chat");
afterEach(async (): Promise<void> => {
  await Promise.all(
    roots.splice(0).map(async (root): Promise<void> => {
      await rm(root, { recursive: true, force: true });
    })
  );
});
const fixture = async (): Promise<string> => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-database-"));
  roots.push(root);
  await mkdir(path.join(root, "features/mcp"), { recursive: true });
  return root;
};

test("offline baseline omits uninstalled schemas and adding MCP extends the same history", async (): Promise<void> => {
  const root = await fixture();
  await mkdir(path.join(root, "lib/db"), { recursive: true });
  await cp(
    path.join(demo, "lib/db/schema.ts"),
    path.join(root, "lib/db/schema.ts")
  );
  await cp(
    path.join(demo, "drizzle.generate.config.ts"),
    path.join(root, "drizzle.generate.config.ts")
  );
  await symlink(
    path.join(demo, "node_modules"),
    path.join(root, "node_modules")
  );
  await writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ compilerOptions: { paths: { "@/*": ["./*"] } } })
  );
  const appPackage = z
    .object({ scripts: z.object({ "db:generate": z.string() }) })
    .parse(
      JSON.parse(await readFile(path.join(demo, "package.json"), "utf-8"))
    );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({
      scripts: { "db:generate": appPackage.scripts["db:generate"] },
    })
  );
  await writeFile(
    path.join(root, "features/installed-database.ts"),
    await planDatabaseSchemas(root, [])
  );
  await generateBaseline(root, "bun");
  const history = path.join(root, "lib/db/migrations");
  const initialFiles = await readdir(history);
  const baselineFile = initialFiles.find((file): boolean =>
    file.endsWith(".sql")
  );
  if (baselineFile === undefined) {
    throw new Error("Expected generated baseline");
  }
  const baseline = await readFile(path.join(history, baselineFile), "utf-8");
  expect(baseline).toContain('CREATE TABLE "user"');
  expect(baseline).not.toContain("McpConnector");
  expect(
    initialFiles.filter((file): boolean => file.endsWith(".sql"))
  ).toHaveLength(1);

  await cp(
    path.join(demo, "features/mcp/db"),
    path.join(root, "features/mcp/db"),
    { recursive: true }
  );
  await cp(
    path.join(demo, "features/mcp/mcp-env.ts"),
    path.join(root, "features/mcp/mcp-env.ts")
  );
  await writeFile(
    path.join(root, "features/mcp/chatjs.json"),
    JSON.stringify(mcpDefinition)
  );
  await writeFile(
    path.join(root, "features/installed-database.ts"),
    await planDatabaseSchemas(root, ["mcp"])
  );
  await runCommand("bun", ["run", "db:generate", "--name=add_mcp"], root);
  expect(await readFile(path.join(history, baselineFile), "utf-8")).toBe(
    baseline
  );
  const nextFiles = await readdir(history);
  const nextFile = nextFiles.find(
    (file): boolean => file.endsWith(".sql") && file !== baselineFile
  );
  if (nextFile === undefined) {
    throw new Error("Expected additive migration");
  }
  const next = await readFile(path.join(history, nextFile), "utf-8");
  expect(next).toContain('CREATE TABLE "McpConnector"');
  expect(next).toContain('CREATE TABLE "McpOAuthSession"');
  expect(next).not.toContain('CREATE TABLE "user"');
  expect(next).not.toContain("DROP");
  await rejects(generateBaseline(root, "bun"), /existing migration history/u);
  const fresh = await fixture();
  await cp(root, fresh, {
    recursive: true,
    filter: (file): boolean => file !== history,
  });
  await generateBaseline(fresh, "npm");
  const freshHistory = path.join(fresh, "lib/db/migrations");
  const freshFiles = await readdir(freshHistory);
  const sqlFiles = freshFiles.filter((file): boolean => file.endsWith(".sql"));
  expect(sqlFiles).toHaveLength(1);
  const fullBaseline = await readFile(
    path.join(freshHistory, sqlFiles[0]),
    "utf-8"
  );
  expect(fullBaseline).toContain('CREATE TABLE "McpConnector"');
  expect(fullBaseline).toContain('CREATE TABLE "user"');
}, 60_000);

test.each(["../outside.ts", "lib/db/schema.ts", "features/other/schema.ts"])(
  "feature schema must remain within its owner: %s",
  async (schema): Promise<void> => {
    const root = await fixture();
    await writeFile(
      path.join(root, "features/mcp/chatjs.json"),
      JSON.stringify({ ...mcpDefinition, databaseSchemas: [schema] })
    );
    await rejects(planDatabaseSchemas(root, ["mcp"]));
  }
);

test("a selected schema must exist before registration", async (): Promise<void> => {
  const root = await fixture();
  await writeFile(
    path.join(root, "features/mcp/chatjs.json"),
    JSON.stringify(mcpDefinition)
  );
  await rejects(planDatabaseSchemas(root, ["mcp"]), /ENOENT/u);
});
