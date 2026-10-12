import {
  PreviewConfigurationError,
  resolveMaintainerPreviewDatabase,
} from "./vercel-preview-environment";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const EMPTY_MESSAGE_LENGTH = 0;
const POSTGRES_CONNECT_TIMEOUT_SECONDS = 10;
const POSTGRES_IDLE_TIMEOUT_SECONDS = 0;
const SINGLE_POSTGRES_CONNECTION = 1;
const POSTGRES_MAX_LIFETIME_SECONDS = 0;
const POSTGRES_CLOSE_TIMEOUT_SECONDS = 5;
const SUBPROCESS_SUCCESS_EXIT_CODE = 0;

interface BuildOperations {
  openDatabase: (url: string) => {
    close: () => Promise<void>;
    execute: (query: string) => Promise<void>;
  };
  run: (
    command: "db:migrate" | "build",
    env: Readonly<NodeJS.ProcessEnv>
  ) => Promise<void>;
}

const formatBuildFailure = (phase: string, error: unknown): string => {
  if (phase === "validation" && error instanceof PreviewConfigurationError) {
    return `Maintainer build failed during validation: ${error.message}`;
  }
  const code =
    error !== null && typeof error === "object" && "code" in error
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

const runMaintainerBuild = async (
  source: Readonly<NodeJS.ProcessEnv>,
  operations: Readonly<BuildOperations>
): Promise<void> => {
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
    if (
      typeof failureMessage !== "string" ||
      failureMessage.length === EMPTY_MESSAGE_LENGTH
    ) {
      phase = "build";
      await operations.run("build", env);
    }
  } catch (error) {
    // Never attach provider errors as a cause: they can contain credentials.
    failureMessage = formatBuildFailure(phase, error);
  }
  if (
    typeof failureMessage === "string" &&
    failureMessage.length > EMPTY_MESSAGE_LENGTH
  ) {
    throw new Error(failureMessage);
  }
};

if (import.meta.main) {
  try {
    await runMaintainerBuild(process.env, {
      openDatabase: (url) => {
        const connection = postgres(url, {
          connect_timeout: POSTGRES_CONNECT_TIMEOUT_SECONDS,
          idle_timeout: POSTGRES_IDLE_TIMEOUT_SECONDS,
          max: SINGLE_POSTGRES_CONNECTION,
          max_lifetime: POSTGRES_MAX_LIFETIME_SECONDS,
        });
        return {
          close: async (): Promise<void> => {
            await connection.end({ timeout: POSTGRES_CLOSE_TIMEOUT_SECONDS });
          },
          execute: async (query): Promise<void> => {
            await connection.unsafe(query);
          },
        };
      },
      run: async (command, env: Readonly<NodeJS.ProcessEnv>): Promise<void> => {
        const child = Bun.spawn(["bun", "run", command], {
          cwd: fileURLToPath(new URL("../apps/chat/", import.meta.url)),
          env,
          stderr: "inherit",
          stdin: "inherit",
          stdout: "inherit",
        });
        const exitCode = await child.exited;
        if (exitCode !== SUBPROCESS_SUCCESS_EXIT_CODE) {
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
export { runMaintainerBuild };
