import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import type postgresType from "../apps/chat/node_modules/postgres";
import {
  PreviewConfigurationError,
  resolveMaintainerPreviewDatabase,
} from "./vercel-preview-environment";

type BuildOperations = {
  openDatabase: (url: string) => {
    close: () => Promise<void>;
    execute: (query: string) => Promise<void>;
  };
  run: (
    command: "db:migrate" | "build",
    env: NodeJS.ProcessEnv
  ) => Promise<void>;
};

const formatBuildFailure = (phase: string, error: unknown) => {
  if (phase === "validation" && error instanceof PreviewConfigurationError) {
    return `Maintainer build failed during validation: ${error.message}`;
  }
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  // Only known code formats are safe to log; provider messages may contain URLs.
  const safeCode =
    typeof code === "string" &&
    /^(?:(?:[0-9]{2}|F0|HV|P0|XX)[0-9A-Z]{3}|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|SUBPROCESS_EXIT_\d{1,3})$/u.test(
      code
    );
  return `Maintainer build failed during ${phase}${safeCode ? ` (${code})` : ""}.`;
};

export const runMaintainerBuild = async (
  source: NodeJS.ProcessEnv,
  operations: BuildOperations
) => {
  let phase = "validation";
  let failureMessage: string | undefined;
  try {
    const preview = resolveMaintainerPreviewDatabase(source);
    const env = { ...source, ...preview };
    if (preview) {
      phase = "connection";
      const connection = operations.openDatabase(
        preview.DATABASE_MIGRATION_URL
      );
      try {
        await connection.execute("SELECT 1");
        phase = "lock acquisition";
        // The overall Vercel build deadline bounds this wait. A slow preceding
        // migration must not fail another valid deployment after only 60 seconds.
        await connection.execute("SET lock_timeout = 0");
        await connection.execute(
          "SELECT pg_advisory_lock(hashtextextended('chatjs-preview-migrations', 0))"
        );
        phase = "migration";
        await operations.run("db:migrate", env);
      } catch (error) {
        failureMessage = formatBuildFailure(phase, error);
      } finally {
        try {
          await connection.close();
        } catch (error) {
          // A cleanup failure must not hide the original migration failure.
          failureMessage ??= formatBuildFailure("lock cleanup", error);
        }
      }
    }
    if (!failureMessage) {
      phase = "build";
      await operations.run("build", env);
    }
  } catch (error) {
    // Never attach provider errors as a cause: they can contain credentials.
    failureMessage = formatBuildFailure(phase, error);
  }
  if (failureMessage) {
    throw new Error(failureMessage);
  }
};

if (import.meta.main) {
  try {
    const require = createRequire(
      new URL("../apps/chat/package.json", import.meta.url)
    );
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Resolve the chat workspace postgres package explicitly; its exported default has the imported postgres type.
    const { default: postgres }: { default: typeof postgresType } =
      await import(require.resolve("postgres"));
    await runMaintainerBuild(process.env, {
      openDatabase: (url) => {
        const connection = postgres(url, {
          connect_timeout: 10,
          idle_timeout: 0,
          max: 1,
          max_lifetime: 0,
        });
        return {
          close: () => connection.end({ timeout: 5 }),
          execute: async (query) => {
            await connection.unsafe(query);
          },
        };
      },
      run: async (command, env) => {
        const child = Bun.spawn(["bun", "run", command], {
          cwd: fileURLToPath(new URL("../apps/chat/", import.meta.url)),
          env,
          stderr: "inherit",
          stdin: "inherit",
          stdout: "inherit",
        });
        const exitCode = await child.exited;
        if (exitCode !== 0) {
          throw Object.assign(new Error("Command failed"), {
            code: `SUBPROCESS_EXIT_${exitCode}`,
          });
        }
      },
    });
  } catch (error) {
    console.error(
      error instanceof Error &&
        error.message.startsWith("Maintainer build failed during ")
        ? error.message
        : "Maintainer build failed during driver initialization."
    );
    process.exitCode = 1;
  }
}
