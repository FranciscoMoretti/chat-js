import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

const handoffSchema = z.object({
  databases: z.record(z.string(), z.url()),
  port: z.number().int().positive(),
  root: z.string(),
});

const preparePostgresFixture = async (input: {
  readonly source: string;
  readonly nodeModules: string;
  readonly handoff: string;
  readonly lane: "lane_a" | "lane_b" | "lane_c" | "lane_d";
}): Promise<{ source: string; nodeModules: string }> => {
  const handoff = handoffSchema.parse(await Bun.file(input.handoff).json());
  const ownership = await Bun.file(path.join(handoff.root, "ownership")).text();
  const url = new URL(z.string().parse(handoff.databases[input.lane]));
  if (
    ownership.trim() !== "chatjs-retirement-disposable-v1" ||
    url.hostname !== "127.0.0.1" ||
    url.username !== "retirement" ||
    url.pathname !== `/${input.lane}` ||
    Number(url.port) !== handoff.port
  ) {
    throw new Error("Expected an owned disposable PostgreSQL lane database");
  }
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-pg-fixture-"));
  const source = path.join(directory, "source");
  const nodeModules = path.join(directory, "node_modules");
  await cp(input.source, source, { recursive: true });
  await mkdir(nodeModules);
  const dependencies = await readdir(input.nodeModules);
  await Promise.all(
    dependencies
      .filter((name) => name !== "@workflow")
      .map(async (name) => {
        await symlink(
          path.resolve(input.nodeModules, name),
          path.join(nodeModules, name)
        );
      })
  );
  await mkdir(path.join(nodeModules, "@workflow"));
  const provider = path.resolve(
    import.meta.dir,
    "../../node_modules/@workflow/world-postgres"
  );
  await symlink(provider, path.join(nodeModules, "@workflow/world-postgres"));
  const agentPath = path.join(source, "agent/agent.ts");
  const agent = await Bun.file(agentPath).text();
  const marker = "defineAgent({";
  const expectedParts = 2;
  if (
    agent.includes("experimental:") ||
    agent.split(marker).length !== expectedParts
  ) {
    throw new Error(
      "Fixture must contain one plain defineAgent definition for explicit Postgres preparation"
    );
  }
  await writeFile(
    agentPath,
    agent.replace(
      marker,
      `${marker}\n  experimental: { workflow: { world: "@workflow/world-postgres" } },`
    )
  );
  await writeFile(
    path.join(source, ".env"),
    `WORKFLOW_POSTGRES_URL=${url.href}\nWORKFLOW_POSTGRES_APPLICATION_MANAGED_SHUTDOWN=1\n`
  );
  await writeFile(
    path.join(source, "postgres-provenance.json"),
    JSON.stringify({
      database: input.lane,
      handoff: path.resolve(input.handoff),
      patch: "patches/workflow-world-postgres@5.0.0-beta.40.patch",
      provider,
      sourceTransform:
        "Add explicit PostgreSQL world to fixture agent definition",
      version: "5.0.0-beta.40",
    })
  );
  return { nodeModules, source };
};
export { preparePostgresFixture };
