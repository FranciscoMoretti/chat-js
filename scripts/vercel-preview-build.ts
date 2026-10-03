/* oxlint-disable import/no-nodejs-modules -- the node:module import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { createRequire } from "node:module";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:url import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { fileURLToPath } from "node:url";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable import/no-relative-parent-imports -- the ../apps/chat/node_modules/postgres import: The source and its build/scaffold consumers share this relative module layout; replacing it needs an alias contract in every consumer. */
import type postgresType from "../apps/chat/node_modules/postgres";
/* oxlint-enable import/no-relative-parent-imports */
import {
  PreviewConfigurationError,
  resolveMaintainerPreviewDatabase,
} from "./vercel-preview-environment";

/* oxlint-disable typescript/consistent-type-definitions -- BuildOperations: The structural alias participates in typed JSON/configuration boundaries; interface conversion changes implicit index assignability and merging. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- BuildOperations: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/consistent-type-definitions */

/* oxlint-disable eslint/no-undefined -- formatBuildFailure: The API distinguishes omitted/undefined values from null or a concrete result; preserve that sentinel. */
/* oxlint-disable typescript/strict-boolean-expressions -- formatBuildFailure: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
const formatBuildFailure = (phase: string, error: unknown): string => {
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/no-undefined */

/* oxlint-disable eslint/max-statements -- runMaintainerBuild: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable eslint/init-declarations -- runMaintainerBuild: Assignment occurs only after branch-specific validation; eager initialization would hide definite-assignment guarantees. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- runMaintainerBuild: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/strict-boolean-expressions -- runMaintainerBuild: The existing predicate intentionally treats absent/empty/false values together; separating them requires a domain-state decision. */
const runMaintainerBuild = async (
  source: NodeJS.ProcessEnv,
  operations: BuildOperations
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
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable node/no-process-env -- vercel-preview-build.ts: This process boundary owns environment loading/forwarding; consumers receive the resulting validated configuration. */
/* oxlint-disable eslint/no-magic-numbers -- vercel-preview-build.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable eslint/no-console -- vercel-preview-build.ts: This command or desktop boundary reports startup, progress and failures to its operator. */
/* oxlint-disable typescript/promise-function-async -- vercel-preview-build.ts: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- vercel-preview-build.ts: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
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
          close: (): Promise<void> => connection.end({ timeout: 5 }),
          execute: async (query): Promise<void> => {
            await connection.unsafe(query);
          },
        };
      },
      run: async (command, env): Promise<void> => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-console */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
export { runMaintainerBuild };
