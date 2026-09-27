import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type postgresType from "../apps/chat/node_modules/postgres";
import { resolveMaintainerPreviewDatabase } from "./vercel-preview-environment";

const appDirectory = fileURLToPath(new URL("../apps/chat/", import.meta.url));
const require = createRequire(
  new URL("../apps/chat/package.json", import.meta.url)
);
const { default: postgres }: { default: typeof postgresType } = await import(
  require.resolve("postgres")
);

const run = async (args: string[], env: NodeJS.ProcessEnv) => {
  const child = Bun.spawn(["bun", ...args], {
    cwd: appDirectory,
    env,
    stderr: "inherit",
    stdin: "inherit",
    stdout: "inherit",
  });
  if ((await child.exited) !== 0) {
    throw new Error("Maintainer preview build command failed.");
  }
};

const build = async () => {
  const preview = resolveMaintainerPreviewDatabase(process.env);
  const env = { ...process.env, ...preview };
  if (preview) {
    // The integration supplies DATABASE_URL to both the build and deployed
    // functions. Only the migration URL needs selecting in this build process.
    const lock = postgres(preview.DATABASE_MIGRATION_URL, {
      connect_timeout: 10,
      idle_timeout: 0,
      max: 1,
      max_lifetime: 0,
    });
    try {
      await lock.unsafe("SET lock_timeout = '60s'");
      await lock`select pg_advisory_lock(hashtextextended('chatjs-preview-migrations', 0))`;
      await run(["run", "db:migrate"], env);
    } finally {
      await lock.end({ timeout: 5 });
    }
  }
  await run(["run", "build"], env);
};

try {
  await build();
} catch (error) {
  // Connection errors may contain credentials. Keep provider details out of logs.
  console.error(
    error instanceof Error && error.message.startsWith("Preview database")
      ? error.message
      : "Maintainer build failed. Check preview database configuration and the build output."
  );
  process.exitCode = 1;
}
