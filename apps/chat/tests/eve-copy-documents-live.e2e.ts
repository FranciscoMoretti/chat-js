/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env"; "../lib/eve/connection-options"; "../lib/eve/contracts" dependency within this package instead of introducing an alias or barrel API.
 */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Client } from "eve/client";
/* oxlint-enable sort-imports */
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  eveConversation,
  eveDocumentHead,
  eveDocumentRevision,
  eveImportedDocumentCheckpointEntry,
  eveUsage,
} from "../lib/db/schema";
/* oxlint-enable sort-imports */
import { env } from "../lib/env";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  conversationBinding,
  createConversationInput,
} from "../lib/eve/contracts";
/* oxlint-enable sort-imports */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports */

assertEveTestDatabase(env.DATABASE_URL);
const modelId = "google/gemini-2.5-flash";
const boundaryReply = /^boundary-ready\.?$/u;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): test("copied document history survives source deletion and supports native editing") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("copied document history survives source deletion and supports native editing") keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("copied document history survives source deletion and supports native editing") uses 240_000, 20_000, 60_000, 503, 1000, 2000, 4000, 200 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): test("copied document history survives source deletion and supports native editing") accepts { page, }; testInfo; route; event; revision; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("copied document history survives source deletion and supports native editing") preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
test("copied document history survives source deletion and supports native editing", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
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
  await page.request.get("/api/dev-login", { maxRedirects: 0 });
  await page.request.post("/api/chat-model", { data: { model: modelId } });
  const { origin } = new URL(z.url().parse(testInfo.project.use.baseURL));
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        'Call createTextDocument exactly once with title "Copy orchard" and content "# Orchard\n\nAmber apples.". Do not use other tools. Then reply briefly.',
      modelId,
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  await page.goto(`/chat/${source.id}`);
  await expect(
    page.getByRole("button", { exact: true, name: 'Created "Copy orchard"' })
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
        content: "# Orchard\n\nCobalt pears.",
        conversationId: source.id,
        documentId: original.documentId,
        expectedRevisionId: original.id,
        operationId: crypto.randomUUID(),
        title: original.title,
      },
    },
  });
  expect(edit.ok(), await edit.text()).toBe(true);
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Reply exactly boundary-ready. Do not use tools.");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(page.getByRole("log").getByText(boundaryReply)).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, source.id));
  const copyInput = {
    modelId,
    operationId: crypto.randomUUID(),
    sourceConversationId: source.id,
  };
  let copied = await page.request.post("/api/agent-conversation-copies", {
    data: copyInput,
    headers: { origin },
  });
  await expect
    .poll(
      async () => {
        if (copied.status() === 503) {
          copied = await page.request.post("/api/agent-conversation-copies", {
            data: copyInput,
            headers: { origin },
          });
        }
        return copied.status();
      },
      { intervals: [1000, 2000, 4000], timeout: 45_000 }
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
  const native = new Client(getEveConnectionOptions(head.ownerId));
  const copiedSession = native.sessions.attach(destination.sessionId);
  let idle = await copiedSession.snapshot();
  await expect
    .poll(
      async () => {
        idle = await copiedSession.snapshot();
        return idle.events.some((event) => event.type === "history.seeded");
      },
      { intervals: [250, 500, 1000], timeout: 20_000 }
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
        documentId: eveImportedDocumentCheckpointEntry.documentId,
        messageIndex: eveImportedDocumentCheckpointEntry.messageIndex,
        revisionId: eveImportedDocumentCheckpointEntry.revisionId,
      })
      .from(eveImportedDocumentCheckpointEntry)
      .where(
        eq(eveImportedDocumentCheckpointEntry.conversationId, destination.id)
      )
  ).toEqual([
    {
      documentId: head.documentId,
      messageIndex: 2,
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
      { intervals: [1000, 2000, 4000], timeout: 45_000 }
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
    .getByRole("button", { exact: true, name: 'Created "Copy orchard"' })
    .click();
  const panel = page.getByTestId("artifact");
  await expect(panel).toContainText("Amber apples.");
  await expect(panel).toContainText("Version 1 of 2");
  await panel.getByRole("button", { exact: true, name: "Next" }).click();
  await expect(panel).toContainText("Cobalt pears.");
  await panel.getByRole("button", { exact: true, name: "Close" }).click();
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(
      `Use readDocument with documentId "${head.documentId}" to read the current "Copy orchard" document. Then use editTextDocument to append a new paragraph "Silver plums." to its current content. Preserve its title and existing content.`
    );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: 'Updated "Copy orchard"' })
  ).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { exact: true, name: 'Updated "Copy orchard"' })
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
  await page
    .getByRole("button", { exact: true, name: "Edit message" })
    .nth(1)
    .click();
  const editor = page.getByRole("dialog");
  await editor
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(
      `Use readDocument with documentId "${head.documentId}" once, then reply briefly. Do not edit the document.`
    );
  await editor.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("imported-edit.png"),
  });
  const forkReply = Promise.withResolvers<{
    input: z.infer<typeof createConversationInput>;
    binding: z.infer<typeof conversationBinding>;
  }>();
  await page.route(
    "**/api/agent-conversations",
    async (route) => {
      const response = await route.fetch();
      expect(response.ok(), await response.text()).toBe(true);
      forkReply.resolve({
        binding: conversationBinding.parse(await response.json()),
        input: createConversationInput.parse(route.request().postDataJSON()),
      });
      await route.fulfill({ response });
    },
    { times: 1 }
  );
  await editor.getByRole("button", { exact: true, name: "Send" }).click();
  const { input: forkInput, binding: forked } = await forkReply.promise;
  expect(forkInput.fork).toEqual({
    beforeMessageId: "seed_message_2",
    conversationId: destination.id,
  });
  await expect(page).toHaveURL(new RegExp(`/chat/${forked.id}$`, "u"));
  const [forkHead] = await db
    .select()
    .from(eveDocumentHead)
    .where(eq(eveDocumentHead.conversationId, forked.id));
  expect(forkHead.revisionId).toBe(head.revisionId);
  await page.goto(`/chat/${forked.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 45_000,
  });
  const forkSnapshot = await native.sessions
    .attach(forked.sessionId)
    .snapshot();
  const seed = forkSnapshot.events.find(
    (event) => event.type === "history.seeded"
  );
  expect(seed?.data.messages).toHaveLength(2);
  expect(
    forkSnapshot.events.some(
      (event) =>
        event.type === "action.result" &&
        event.data.result.kind === "tool-result" &&
        event.data.result.toolName === "readDocument"
    )
  ).toBe(true);
  const replay = await page.request.post("/api/agent-conversations", {
    data: forkInput,
    headers: { origin },
  });
  expect(await replay.json()).toEqual(forked);
  const changed = await page.request.post("/api/agent-conversations", {
    data: {
      ...forkInput,
      fork: { ...forkInput.fork, beforeMessageId: "seed_message_0" },
    },
    headers: { origin },
  });
  expect(changed.status()).toBe(409);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */

/* oxlint-disable max-lines -- #509: This eve-copy-documents-live.e2e.ts module keeps its existing fixture/scenario boundaries; splitting it requires an ownership design. EOF-scoped exception applies only to this file-level line metric. */
