import { and, eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { z } from "zod";

import {
  legacyModelReceipts,
  legacyToolReceipts,
} from "@/lib/eve/legacy-model-accounting";
import { assertPostgresLifecycleCompatibility } from "@/lib/eve/lifecycle/postgres/compatibility";
import { readEvePostgresRunInventory } from "@/lib/eve/lifecycle/postgres/eve-run-inventory";

import { db } from "./client";
import { recordEveUsage } from "./eve-billing";
import { eveConversation, eveSubagentSession, eveUsage } from "./schema";

const archiveSchema = z.object({
  ownerId: z.string().min(1),
  rootSessionId: z.string().min(1),
  target: z.object({
    database: z.string(),
    address: z.string(),
    port: z.number(),
  }),
  sessions: z.array(
    z.object({ sessionId: z.string().min(1), events: z.array(z.unknown()) })
  ),
});

const verifyRetirement = async (
  plan: z.output<typeof archiveSchema>
): Promise<void> => {
  const connection = db.$client;
  const [target] =
    await connection`select current_database() as database, inet_server_addr()::text as address, inet_server_port() as port`;
  if (
    target?.database !== plan.target.database ||
    target.address !== plan.target.address ||
    target.port !== plan.target.port
  ) {
    throw new Error("Accounting preparation target changed.");
  }
  await assertPostgresLifecycleCompatibility(connection);
  const [marker] =
    await connection`select session_id from workflow.eve_session_retirements where session_id=${plan.rootSessionId}`;
  const inventory = await readEvePostgresRunInventory(
    connection,
    plan.rootSessionId
  );
  const hasMarker = Boolean(marker);
  if (
    !hasMarker ||
    inventory.activeRunIds.length ||
    inventory.missingRunIds.length ||
    inventory.ambiguousStreamIds.length
  ) {
    throw new Error(
      "Accounting preparation requires complete native retirement."
    );
  }
  const runs = new Set(inventory.runs.map((run) => run.id));
  if (plan.sessions.some((session) => !runs.has(session.sessionId))) {
    throw new Error("Archived session is outside the retired run family.");
  }
  const resources = [
    ...inventory.runs.map((run) => `run:${run.id}`),
    ...inventory.streamIds.map((id) => `stream:${id}`),
  ];
  const fences =
    await connection`select resource from workflow.eve_resource_fences where fenced and resource in ${connection(resources)}`;
  if (fences.length !== resources.length) {
    throw new Error(
      "Accounting preparation requires every native resource fence."
    );
  }
};

/** Offline only. Admission and workers must already be stopped for this scope.
 * Imports reviewed archive facts after verifying the exact database and native
 * retirement. Missing-attempt completeness is deliberately left as a liability:
 * an event archive cannot prove a provider did not charge before a lost receipt.
 */
export const prepareEveModelAccounting = async ({
  archive,
  digest,
}: {
  readonly archive: string;
  readonly digest: string;
}): Promise<void> => {
  if (createHash("sha256").update(archive).digest("hex") !== digest) {
    throw new Error("Accounting archive digest mismatch.");
  }
  const plan = archiveSchema.parse(JSON.parse(archive));
  const rows = await db
    .select()
    .from(eveConversation)
    .where(
      and(
        eq(eveConversation.ownerId, plan.ownerId),
        eq(eveConversation.sessionId, plan.rootSessionId)
      )
    );
  const binding = rows.at(0);
  if (!binding || binding.modelAccountingState === "wrapper") {
    throw new Error("Expected an owned prelaunch accounting scope.");
  }
  const children = await db
    .select({
      sessionId: eveSubagentSession.sessionId,
      rootTurnId: eveSubagentSession.rootTurnId,
    })
    .from(eveSubagentSession)
    .where(
      and(
        eq(eveSubagentSession.ownerId, plan.ownerId),
        eq(eveSubagentSession.conversationId, binding.id)
      )
    );
  const expected = [
    plan.rootSessionId,
    ...children.map((child) => child.sessionId),
  ].toSorted();
  const actual = plan.sessions.map((session) => session.sessionId).toSorted();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      "Accounting archive must include the exact owned root and descendants."
    );
  }
  await verifyRetirement(plan);
  const liabilityId = `eve-legacy-inventory:${plan.rootSessionId}`;
  const [existing] = await db
    .select()
    .from(eveUsage)
    .where(eq(eveUsage.eventId, liabilityId));
  if (
    Boolean(existing) &&
    z.object({ archiveDigest: z.string() }).parse(existing.modelAttempt)
      .archiveDigest !== digest
  ) {
    throw new Error(
      "Accounting archive changed; reconcile the existing preparation."
    );
  }
  await recordEveUsage({
    eventId: liabilityId,
    ownerId: plan.ownerId,
    sessionId: plan.rootSessionId,
    turnId: "chatjs:legacy-reconciliation",
    modelAttempt: { archiveDigest: digest, state: "legacy-unresolved" },
  });
  // Ordered idempotent writes survive interruption; state remains unprepared
  // until the complete import succeeds. Never launch this from an HTTP request.
  /* oxlint-disable no-await-in-loop */
  for (const session of plan.sessions) {
    const child = children.find(
      (entry) => entry.sessionId === session.sessionId
    );
    for (const event of session.events) {
      const receipts = [
        ...legacyModelReceipts(event, child?.sessionId),
        ...legacyToolReceipts(event, session.sessionId),
      ];
      for (const receipt of receipts) {
        await recordEveUsage({
          eventId: receipt.eventId,
          costUsd: receipt.costUsd,
          generationId: receipt.generationId,
          ownerId: plan.ownerId,
          sessionId: plan.rootSessionId,
          turnId: child?.rootTurnId ?? receipt.turnId,
        });
        if (receipt.unresolvedFailure) {
          // Preserve a historical failed-call zero while exposing its unproven price.
          await recordEveUsage({
            eventId: `eve-legacy-unresolved:${receipt.eventId}`,
            ownerId: plan.ownerId,
            sessionId: plan.rootSessionId,
            turnId: child?.rootTurnId ?? receipt.turnId,
          });
        }
      }
    }
  }
  /* oxlint-enable no-await-in-loop */
  await verifyRetirement(plan);
  await db
    .update(eveConversation)
    .set({ modelAccountingState: "retired" })
    .where(
      and(
        eq(eveConversation.id, binding.id),
        eq(eveConversation.ownerId, plan.ownerId),
        eq(eveConversation.sessionId, plan.rootSessionId)
      )
    );
};
