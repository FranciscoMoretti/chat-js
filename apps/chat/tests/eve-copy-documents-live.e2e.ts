import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";
import { db } from "../lib/db/client";
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
  eveImportedDocumentCheckpointEntry,
  eveUsage,
} from "../lib/db/schema";
import { env } from "../lib/env";
import { conversationBinding } from "../lib/eve/contracts";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const modelId = "google/gemini-2.5-flash";
const boundaryReply = /^boundary-ready\.?$/;

test("copied document history survives source deletion and supports native editing", async ({
  page,
}) => {
  test.setTimeout(180_000);
  page.setDefaultTimeout(20_000);
  page.setDefaultNavigationTimeout(60_000);
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      const style = document.createElement("style");
      style.textContent =
        ".tsqd-parent-container, nextjs-portal { display: none !important; }";
      document.head.append(style);
    });
  });
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.request.post("/api/chat-model", { data: { model: modelId } });
  const origin = new URL(page.url()).origin;
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId,
      message:
        'Call createTextDocument exactly once with title "Copy orchard" and content "# Orchard\n\nAmber apples.". Do not use other tools. Then reply briefly.',
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(
    page.getByRole("button", { name: 'Created "Copy orchard"', exact: true })
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const [original] = await db
    .select()
    .from(eveDocumentRevision)
    .where(eq(eveDocumentRevision.conversationId, source.id));
  expect(original.content).toBe("# Orchard\n\nAmber apples.");
  const edit = await page.request.post("/api/trpc/eve.saveDocument", {
    data: {
      json: {
        conversationId: source.id,
        documentId: original.documentId,
        expectedRevisionId: original.id,
        operationId: crypto.randomUUID(),
        title: original.title,
        content: "# Orchard\n\nCobalt pears.",
      },
    },
  });
  expect(edit.ok(), await edit.text()).toBe(true);
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("Reply exactly boundary-ready. Do not use tools.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByRole("log").getByText(boundaryReply)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, source.id));
  const copyInput = {
    sourceConversationId: source.id,
    operationId: crypto.randomUUID(),
    modelId,
  };
  let copied = await page.request.post("/api/agent-conversation-copies", {
    headers: { origin },
    data: copyInput,
  });
  await expect
    .poll(
      async () => {
        if (copied.status() === 503) {
          copied = await page.request.post("/api/agent-conversation-copies", {
            headers: { origin },
            data: copyInput,
          });
        }
        return copied.status();
      },
      { timeout: 45_000, intervals: [1000, 2000, 4000] }
    )
    .toBe(200);
  const destination = conversationBinding.parse(await copied.json());
  const revisions = await db
    .select()
    .from(eveDocumentRevision)
    .where(eq(eveDocumentRevision.conversationId, destination.id));
  expect(revisions).toHaveLength(2);
  const [head] = await db
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, destination.id));
  expect(head.documentId).not.toBe(original.documentId);
  const native = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": head.ownerId },
  });
  const copiedSession = native.sessions.attach(destination.sessionId);
  let idle = await copiedSession.snapshot();
  await expect
    .poll(
      async () => {
        idle = await copiedSession.snapshot();
        return idle.events.some((event) => event.type === "history.seeded");
      },
      { timeout: 20_000, intervals: [250, 500, 1000] }
    )
    .toBe(true);
  expect(
    idle.events.some(
      (event) =>
        event.type === "turn.started" || event.type === "actions.requested"
    )
  ).toBe(false);
  const latest = revisions.find((revision) => revision.id === head.revisionId);
  expect(latest?.content).toBe("# Orchard\n\nCobalt pears.");
  expect(
    await db
      .select({
        messageIndex: eveImportedDocumentCheckpointEntry.messageIndex,
        documentId: eveImportedDocumentCheckpointEntry.documentId,
        revisionId: eveImportedDocumentCheckpointEntry.revisionId,
      })
      .from(eveImportedDocumentCheckpointEntry)
      .where(
        eq(eveImportedDocumentCheckpointEntry.conversationId, destination.id)
      )
  ).toEqual([
    {
      messageIndex: 2,
      documentId: head.documentId,
      revisionId: head.revisionId,
    },
  ]);
  expect(
    revisions.find((revision) => revision.id === latest?.parentRevisionId)
      ?.content
  ).toBe(original.content);
  expect(
    revisions.every(
      (revision) =>
        revision.id !== original.id && revision.documentId === head.documentId
    )
  ).toBe(true);
  expect(
    await db
      .select({ eventId: eveUsage.eventId })
      .from(eveUsage)
      .where(eq(eveUsage.sessionId, destination.sessionId))
  ).toEqual([]);
  await expect
    .poll(
      async () => {
        const response = await page.request.delete(
          `/api/agent-conversations/${source.id}`,
          { headers: { origin } }
        );
        expect(response.ok(), await response.text()).toBe(true);
        return z.object({ status: z.string() }).parse(await response.json())
          .status;
      },
      { timeout: 45_000, intervals: [1000, 2000, 4000] }
    )
    .toBe("deleted");
  expect(
    await db
      .select({ id: eveDocumentRevision.id })
      .from(eveDocumentRevision)
      .where(eq(eveDocumentRevision.conversationId, source.id))
  ).toEqual([]);
  await page.goto(`/chat/${destination.id}`);
  await page
    .getByRole("button", { name: 'Created "Copy orchard"', exact: true })
    .click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText("Amber apples.");
  await expect(panel).toContainText("Version 1 of 2");
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(panel).toContainText("Cobalt pears.");
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      `Use readDocument with documentId "${head.documentId}" to read the current "Copy orchard" document. Then use editTextDocument to append a new paragraph "Silver plums." to its current content. Preserve its title and existing content.`
    );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: 'Updated "Copy orchard"', exact: true })
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: 'Updated "Copy orchard"', exact: true })
    .click();
  await expect(panel).toContainText("Cobalt pears.");
  await expect(panel).toContainText("Silver plums.");
  await expect(panel).toContainText("Version 3 of 3");
  const snapshot = await native.sessions
    .attach(destination.sessionId)
    .snapshot();
  expect(
    snapshot.events.some(
      (event) =>
        event.type === "action.result" &&
        event.data.result.kind === "tool-result" &&
        event.data.result.toolName === "readDocument"
    )
  ).toBe(true);
});
