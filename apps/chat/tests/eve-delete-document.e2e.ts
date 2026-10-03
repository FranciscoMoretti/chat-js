/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/connection-options" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { expect, test } from "@playwright/test";
import { and, eq, sql } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import { eveConversation, eveDocumentHead, userCredit } from "../lib/db/schema";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("installed deleteDocument requires approval, survives reload, and honors rejecti keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("installed deleteDocument requires approval, survives reload, and honors rejecti keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("installed deleteDocument requires approval, survives reload, and honors rejecti uses 240_000, -1, 1, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * oxc/no-async-await (#540): test("installed deleteDocument requires approval, survives reload, and honors rejecti sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): test("installed deleteDocument requires approval, survives reload, and honors rejecti handles optional document?.sessionId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): test("installed deleteDocument requires approval, survives reload, and honors rejecti accepts { page, }; testInfo; route; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): test("installed deleteDocument requires approval, survives reload, and honors rejecti preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("installed deleteDocument requires approval, survives reload, and honors rejecti intentionally keeps the existing falsy-value behavior of chatId; document?.sessionId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
test("installed deleteDocument requires approval, survives reload, and honors rejection", async ({
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const session = z.object({ user: z.object({ id: z.string() }) }).parse(
    await page.evaluate(async () => {
      const response = await fetch("/api/auth/get-session");
      const responseBody: unknown = await response.json();
      return responseBody;
    })
  );
  await db
    .insert(userCredit)
    .values({ credits: 1000, userId: session.user.id })
    .onConflictDoUpdate({
      set: { credits: sql`greatest(${userCredit.credits}, 1000)` },
      target: userCredit.userId,
    });
  await page.context().addCookies([
    {
      name: "chat-model",
      url: new URL(page.url()).origin,
      value: encodeURIComponent("openai/gpt-4.1-mini"),
    },
  ]);
  await page.goto("/");
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill(
    'Call createTextDocument with title "Approval orchard" and content "Apples and pears.". Do not use other tools. Finish briefly.'
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", {
      exact: true,
      name: 'Created "Approval orchard"',
    })
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const chatId = new URL(page.url()).pathname.split("/").at(-1);
  if (!chatId) {
    throw new Error("Missing conversation");
  }
  const [document] = await db
    .select({
      conversationId: eveDocumentHead.conversationId,
      documentId: eveDocumentHead.documentId,
      sessionId: eveConversation.sessionId,
    })
    .from(eveDocumentHead)
    .innerJoin(
      eveConversation,
      eq(eveConversation.id, eveDocumentHead.conversationId)
    )
    .where(
      and(
        eq(eveConversation.chatId, chatId),
        eq(eveConversation.ownerId, session.user.id)
      )
    );
  if (!document?.sessionId) {
    throw new Error("Missing created document");
  }
  const { conversationId } = document;
  const client = new Client(getEveConnectionOptions(session.user.id));
  const native = client.sessions.attach(document.sessionId);
  const deletionPrompt = `Read document ${document.documentId} with readDocument and then call deleteDocument using its exact title and current revision. I want it removed from this conversation. Call the tool now; its built-in approval controls will ask me to approve. Do not ask for confirmation in a chat message.`;
  await composer.fill(deletionPrompt);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toBeVisible({ timeout: 90_000 });
  await page.reload();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toBeVisible();
  await expect(page.getByRole("log")).toContainText(
    '"title": "Approval orchard"'
  );
  await page
    .getByRole("region", { name: "Tool result" })
    .filter({ has: page.getByRole("button", { exact: true, name: "Approve" }) })
    .screenshot({ path: testInfo.outputPath("approval.png") });
  await page.getByRole("button", { exact: true, name: "Cancel" }).click();
  await expect(
    page.getByText("Request declined.", { exact: true })
  ).toBeVisible();
  expect(
    await db
      .select()
      .from(eveDocumentHead)
      .where(eq(eveDocumentHead.conversationId, conversationId))
  ).toHaveLength(1);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await composer.fill(deletionPrompt);
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("button", { exact: true, name: "Approve" })
  ).toBeVisible({ timeout: 90_000 });
  const beforeApproval = await native.snapshot();
  await page.getByRole("button", { exact: true, name: "Approve" }).click();
  await expect(
    page.getByText("Tool completed.", { exact: true })
  ).toBeVisible();
  await expect
    .poll(
      async () =>
        await db
          .select()
          .from(eveDocumentHead)
          .where(eq(eveDocumentHead.conversationId, conversationId))
    )
    .toHaveLength(0);
  await expect(
    page
      .getByText("Document is no longer available in this conversation.")
      .last()
  ).toBeAttached();
  await page
    .getByTestId("document-preview")
    .last()
    .screenshot({ path: testInfo.outputPath("unavailable-preview.png") });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const afterApproval = await native.snapshot();
  const resumedSteps = afterApproval.events
    .slice(beforeApproval.events.length)
    .filter((event) => event.type === "step.started");
  expect(resumedSteps.length).toBeGreaterThan(0);
  for (const step of resumedSteps) {
    expect(step.data.modelId).toBe("gateway/openai/gpt-4.1-mini");
    expect(
      afterApproval.events.some(
        (event) =>
          event.type === "turn.started" &&
          event.data.turnId === step.data.turnId
      )
    ).toBe(true);
  }
});
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, oxc/no-async-await, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
