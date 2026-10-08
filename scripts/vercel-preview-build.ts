import {
  PreviewConfigurationError,
  resolveMaintainerPreviewDatabase,
} from "./vercel-preview-environment";
// oxlint-disable-next-line import/no-nodejs-modules -- The preview-build entry point resolves the chat workspace database driver and command working directory.
import { createRequire } from "node:module";
// oxlint-disable-next-line import/no-nodejs-modules -- The preview-build entry point resolves the chat workspace database driver and command working directory.
import { fileURLToPath } from "node:url";
import type postgresType from "postgres";

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

/* oxlint-disable eslint/no-undefined -- formatBuildFailure: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
const formatBuildFailure = (phase: string, error: unknown): string => {
  if (phase === "validation" && error instanceof PreviewConfigurationError) {
    return `Maintainer build failed during validation: ${error.message}`;
  }
  const code =
    // oxlint-disable-next-line no-ternary -- Keep code as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    error !== null && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  // Only known code formats are safe to log; provider messages may contain URLs.
  const safeCode =
    typeof code === "string" &&
    /^(?:(?:[0-9]{2}|F0|HV|P0|XX)[0-9A-Z]{3}|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|SUBPROCESS_EXIT_\d{1,3})$/u.test(
      code
    );
  // oxlint-disable-next-line no-ternary -- Keep template interpolation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  return `Maintainer build failed during ${phase}${safeCode ? ` (${code})` : ""}.`;
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runMaintainerBuild's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable eslint/max-statements -- One phase/error scope coordinates connection, advisory-lock migration, cleanup and build; the finally cleanup must not replace the original sanitized migration failure. */
/* oxlint-disable eslint/init-declarations -- The initial undefined failure sentinel permits cleanup errors to be recorded by ??=; an empty-string initializer would suppress those errors. */
const runMaintainerBuild = async (
  source: Readonly<NodeJS.ProcessEnv>,
  operations: Readonly<BuildOperations>
): Promise<void> => {
  let phase = "validation";
  let failureMessage: string | undefined;
  try {
    const preview = resolveMaintainerPreviewDatabase(source);
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing source own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing preview own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable node/no-process-env -- vercel-preview-build.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable eslint/no-console -- vercel-preview-build.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable typescript/promise-function-async -- vercel-preview-build.ts: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
if (import.meta.main) {
  try {
    const require = createRequire(
      new URL("../apps/chat/package.json", import.meta.url)
    );
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Resolve the chat workspace postgres package explicitly; its exported default has the imported postgres type.
    const { default: postgres }: { default: typeof postgresType } =
      // oxlint-disable-next-line node/no-top-level-await -- This Bun build entrypoint resolves its workspace Postgres driver before opening the preview database.
      await import(require.resolve("postgres"));
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve callbacks in this statement's awaited sequencing and rejected-Promise behavior. */
    // oxlint-disable-next-line node/no-top-level-await -- This Bun build entrypoint awaits migration/build completion so its existing catch reports failures.
    await runMaintainerBuild(process.env, {
      openDatabase: (url) => {
        const connection = postgres(url, {
          connect_timeout: POSTGRES_CONNECT_TIMEOUT_SECONDS,
          idle_timeout: POSTGRES_IDLE_TIMEOUT_SECONDS,
          max: SINGLE_POSTGRES_CONNECTION,
          max_lifetime: POSTGRES_MAX_LIFETIME_SECONDS,
        });
        return {
          close: (): Promise<void> =>
            connection.end({ timeout: POSTGRES_CLOSE_TIMEOUT_SECONDS }),
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
    /* oxlint-enable oxc/no-async-await */
  } catch (error) {
    console.error(
      // oxlint-disable-next-line no-ternary -- Keep console.error argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      error instanceof Error &&
        error.message.startsWith("Maintainer build failed during ")
        ? error.message
        : "Maintainer build failed during driver initialization."
    );
    process.exitCode = 1;
  }
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (runMaintainerBuild); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-console */
/* oxlint-enable node/no-process-env */
export { runMaintainerBuild };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
