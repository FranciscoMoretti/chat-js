import type { CreateSandboxFromSnapshotParams, Sandbox } from "@daytona/sdk";
import { Daytona, DaytonaNotFoundError } from "@daytona/sdk";
import type { CodeSandboxCleanupSession } from "@/lib/ai/installed-tool-capabilities";
import type { ExecutionSandbox } from "@/tools/chatjs/_shared/code-execution/types";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-disable-next-line import/no-nodejs-modules -- Server-side credential scope hashing must use Node crypto and never expose the API key. */
import { createHash } from "node:crypto";

const API_URL = "https://app.daytona.io/api";
const REQUEST_TIMEOUT_MS = 30_000;
const OPERATION_TIMEOUT_SECONDS = 60;
const EXECUTION_TIMEOUT_SECONDS = 300;
const LIFETIME_MINUTES = 10;

interface DaytonaResource {
  readonly name: string;
  readonly organizationId: string;
  readonly state?: Sandbox["state"];
  readonly process: Readonly<Pick<Sandbox["process"], "executeCommand">>;
  readonly delete: Sandbox["delete"];
}
interface DaytonaClient {
  readonly create: (
    params: ReadonlyNativeSurface<
      Pick<
        CreateSandboxFromSnapshotParams,
        | "autoStopInterval"
        | "ephemeral"
        | "labels"
        | "language"
        | "name"
        | "public"
        | "ttlMinutes"
      >
    >,
    options?: Readonly<{ timeout?: number }>
  ) => Promise<DaytonaResource>;
  readonly get: (name: string) => Promise<DaytonaResource>;
}
interface DaytonaProvider {
  readonly cleanup: CodeSandboxCleanupSession;
  readonly create: (
    name: string,
    language: "python" | "javascript"
  ) => Promise<DaytonaResource>;
}
type Credentials = Readonly<{ apiKey: string; organizationId: string }>;

const shellArgument = (value: string): string =>
  `'${value.replaceAll("'", String.raw`'\''`)}'`;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve waitForCommand's awaited sequencing and rejected-Promise behavior. */
const waitForCommand = async <Result>(
  operation: Readonly<Promise<Result>>,
  signal: ReadonlyNativeSurface<AbortSignal>
): Promise<Result> => {
  const cancelled = Promise.withResolvers<never>();
  const stop = (): void => {
    cancelled.reject(new Error("Daytona command cancelled"));
  };
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) {
    stop();
  }
  try {
    return await Promise.race([operation, cancelled.promise]);
  } finally {
    signal.removeEventListener("abort", stop);
  }
};
/* oxlint-enable oxc/no-async-await */
const commandSandbox = (
  resource: DaytonaResource,
  signal: ReadonlyNativeSurface<AbortSignal>
): ExecutionSandbox => ({
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runCommand's awaited sequencing and rejected-Promise behavior. */
  async runCommand({
    cmd,
    args,
  }: Readonly<{ cmd: string; args: readonly string[] }>) {
    signal.throwIfAborted();
    const result = await waitForCommand(
      resource.process.executeCommand(
        [cmd, ...args].map((argument) => shellArgument(argument)).join(" "),
        "/tmp",
        {},
        EXECUTION_TIMEOUT_SECONDS
      ),
      signal
    );
    signal.throwIfAborted();
    // Daytona exposes combined command output; keep it once in stdout.
    return {
      exitCode: result.exitCode,
      stderr: async () => await Promise.resolve(""),
      stdout: async () => await Promise.resolve(result.result),
    };
  },
  /* oxlint-enable oxc/no-async-await */
});

const assertIdentity = (
  resource: DaytonaResource,
  name: string,
  organizationId: string
): void => {
  if (resource.name !== name || resource.organizationId !== organizationId) {
    throw new Error(
      "Daytona sandbox identity does not match its allocation intent."
    );
  }
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve findResource's awaited sequencing and rejected-Promise behavior. */
const findResource = async (
  client: DaytonaClient,
  identity: Readonly<{ name: string; organizationId: string }>
): Promise<DaytonaResource | null> => {
  try {
    const resource = await client.get(identity.name);
    assertIdentity(resource, identity.name, identity.organizationId);
    return resource;
  } catch (error) {
    if (error instanceof DaytonaNotFoundError) {
      // oxlint-disable-next-line unicorn/no-null -- Null is explicit provider absence, distinct from an unsuccessful request.
      return null;
    }
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
const cleanupSession = (
  client: DaytonaClient,
  credentials: Credentials
): CodeSandboxCleanupSession => ({
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteAndConfirmAbsent's awaited sequencing and rejected-Promise behavior. */
  async deleteAndConfirmAbsent(name) {
    const identity = { name, organizationId: credentials.organizationId };
    const resource = await findResource(client, identity);
    if (resource === null || resource.state === "destroyed") {
      return;
    }
    await resource.delete(OPERATION_TIMEOUT_SECONDS, true);
    const remaining = await findResource(client, identity);
    if (remaining !== null && remaining.state !== "destroyed") {
      throw new Error("Daytona sandbox remains available after deletion.");
    }
  },
  /* oxlint-enable oxc/no-async-await */
  provider: {
    // API-key auth ignores organizationId in the SDK. Pin the credential scope
    // so replacing it cannot turn a foreign 404 into proof of prior deletion.
    projectId: `${API_URL}#${createHash("sha256").update(credentials.apiKey).digest("hex")}`,
    teamId: `daytona:${credentials.organizationId}`,
  },
});

const createDaytonaProvider = (
  credentials: Credentials,
  client?: DaytonaClient
): DaytonaProvider => {
  if (
    credentials.apiKey.trim() === "" ||
    credentials.organizationId.trim() === ""
  ) {
    throw new Error(
      "DAYTONA_API_KEY and DAYTONA_ORGANIZATION_ID are required."
    );
  }
  const selectedClient =
    client ??
    new Daytona({
      apiKey: credentials.apiKey,
      apiUrl: API_URL,
      organizationId: credentials.organizationId,
      otelEnabled: false,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
    });
  return {
    cleanup: cleanupSession(selectedClient, credentials),
    /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve create's awaited sequencing and rejected-Promise behavior. */
    async create(name, language): Promise<DaytonaResource> {
      const resource = await selectedClient.create(
        {
          autoStopInterval: LIFETIME_MINUTES,
          ephemeral: true,
          labels: { "chatjs-allocation": name },
          language,
          name,
          public: false,
          ttlMinutes: LIFETIME_MINUTES,
        },
        { timeout: OPERATION_TIMEOUT_SECONDS }
      );
      assertIdentity(resource, name, credentials.organizationId);
      return resource;
    },
    /* oxlint-enable oxc/no-async-await */
  };
};

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (commandSandbox, createDaytonaProvider); the enabled import/no-default-export convention rejects the default-export alternative. */
export { commandSandbox, createDaytonaProvider };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (DaytonaProvider, DaytonaResource); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { DaytonaProvider, DaytonaResource };
/* oxlint-enable import/no-named-export */
