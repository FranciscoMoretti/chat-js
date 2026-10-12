import { open, realpath } from "node:fs/promises";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { assertEveConfigured } from "./server";
import { constants } from "node:fs";
import { createHash } from "node:crypto";
import { env } from "@/lib/env";
import { isDeepStrictEqual } from "node:util";
import nodePath from "node:path";
import postgres from "postgres";
import { verifyEveSandboxCoverage } from "@/lib/eve/lifecycle/postgres/eve-sandbox-coverage-proof";
import { z } from "zod";

const MIN_IDENTITY_VALUE_LENGTH = 1;
const IDENTITY_VERSION = 1;
const RECEIPT_SNAPSHOT_VERSION = 2;
const COVERAGE_READ_TIMEOUT_MS = 15_000;
const MAX_IDENTITY_FILE_BYTES = 16_384;
const MAX_DATABASE_CONNECTIONS = 1;

const identitySchema = z.strictObject({
  appRoot: z.string().min(MIN_IDENTITY_VALUE_LENGTH),
  backendName: z.literal("microsandbox"),
  sessionId: z.string().min(MIN_IDENTITY_VALUE_LENGTH),
  version: z.literal(IDENTITY_VERSION),
});
const receiptSchema = z.strictObject({
  local: identitySchema,
  sessionId: z.string().min(MIN_IDENTITY_VALUE_LENGTH),
  snapshotVersion: z.literal(RECEIPT_SNAPSHOT_VERSION),
  version: z.literal(IDENTITY_VERSION),
});

/**
 * Verify native and local sandbox identity evidence for every retired family inventory.
 * Call only after family authorization, retirement and native/local fences.
 * @param {string} ownerId - Authorized family owner sent with native deletion-evidence requests.
 * @param {string} appRoot - Worker application root, canonicalized before comparing identity receipts.
 * @param {{ sessionId: string; runIds: string[]; }[]} inventories - Session roots and run IDs whose sandbox coverage must be proven.
 */
export const verifyLocalEveFamilyCoverage = async (
  ownerId: string,
  appRoot: string,
  inventories: ReadonlyNativeSurface<
    {
      readonly sessionId: string;
      readonly runIds: readonly string[];
    }[]
  >
): Promise<void> => {
  assertEveConfigured();
  const canonicalRoot = await realpath(appRoot);
  const connection = postgres(env.WORKFLOW_POSTGRES_URL ?? "", {
    max: MAX_DATABASE_CONNECTIONS,
  });
  try {
    for (const inventory of inventories) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Use the single-connection coverage transaction and finish native/local identity verification before checking the next family inventory; mismatch must stop proof generation.
      await verifyEveSandboxCoverage(
        connection,
        { ...inventory, appRoot: canonicalRoot },
        async (sessionId) => {
          const response = await fetch(
            new URL(
              `/eve/chat/v1/session/${encodeURIComponent(sessionId)}/sandbox-identity`,
              env.EVE_INTERNAL_ORIGIN
            ),
            {
              cache: "no-store",
              headers: {
                authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
                "x-chatjs-deletion": "1",
                "x-chatjs-deletion-root": inventory.sessionId,
                "x-chatjs-owner": ownerId,
              },
              redirect: "error",
              signal: AbortSignal.timeout(COVERAGE_READ_TIMEOUT_MS),
            }
          );
          if (!response.ok) {
            throw new Error(
              "Native sandbox ownership evidence is unavailable."
            );
          }
          const receipt = receiptSchema.parse(await response.json());
          const expected = {
            appRoot: canonicalRoot,
            backendName: "microsandbox",
            sessionId,
            version: IDENTITY_VERSION,
          };
          if (
            receipt.sessionId !== sessionId ||
            !isDeepStrictEqual(receipt.local, expected)
          ) {
            throw new Error(
              "Native sandbox ownership does not match this worker."
            );
          }
          const directory = nodePath.join(
            canonicalRoot,
            ".eve",
            "sandbox-identities"
          );
          if ((await realpath(directory)) !== directory) {
            throw new Error(
              "Sandbox identity directory must not be redirected."
            );
          }
          const file = await open(
            nodePath.join(
              directory,
              `${createHash("sha256").update(sessionId).digest("hex")}.json`
            ),
            constants.O_NOFOLLOW
          );
          try {
            const stat = await file.stat();
            if (!stat.isFile() || stat.size > MAX_IDENTITY_FILE_BYTES) {
              throw new Error("Invalid sandbox identity file.");
            }
            const local = identitySchema.parse(
              JSON.parse(await file.readFile("utf-8"))
            );
            if (!isDeepStrictEqual(local, expected)) {
              throw new Error(
                "Local sandbox ownership does not match native evidence."
              );
            }
          } finally {
            await file.close();
          }
        }
      );
    }
  } finally {
    await connection.end();
  }
};
