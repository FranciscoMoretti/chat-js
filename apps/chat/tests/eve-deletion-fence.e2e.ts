/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/env" dependency within this package instead of introducing an alias or barrel API.
 */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable sort-imports */
import { eveConversation } from "../lib/db/schema";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { env } from "../lib/env";
/* oxlint-enable sort-imports */
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-enable import/no-relative-parent-imports */

if (!["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("Deletion tests require local Postgres.");
}

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async --
 * max-lines-per-function (#510): for (const state of ["deleting", "deleted"] as const) { keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): for (const state of ["deleting", "deleted"] as const) { keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): for (const state of ["deleting", "deleted"] as const) { uses 404, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/prefer-readonly-parameter-types (#565): for (const state of ["deleting", "deleted"] as const) { accepts { page, browser, }; route; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): for (const state of ["deleting", "deleted"] as const) { preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 */
for (const state of ["deleting", "deleted"] as const) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test(`${state} conversation rejects browser access and old creation requests`, async ({
    page,
    browser,
  }) => {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    const owner = z
      .object({ user: z.object({ id: z.string() }) })
      .parse(await (await page.request.get("/api/auth/get-session")).json())
      .user.id;
    const id = crypto.randomUUID();
    const operationId = crypto.randomUUID();
    const sessionId = `wrun_deleted_${id}`;
    await insertEveConversationFixtures({
      firstMessage: "Deleted test conversation",
      id,
      operationId,
      ownerId: owner,
      sessionId,
      state,
      visibility: "public",
    });
    const anonymous = await browser.newContext();
    try {
      const retry = await page.request.post("/api/agent-conversations", {
        data: {
          message: "Deleted test conversation",
          modelId: "openai/gpt-5-mini",
          operationId,
        },
        headers: { origin: new URL(page.url()).origin },
      });
      expect(retry.status()).toBe(404);
      expect(await retry.json()).toMatchObject({ creationRejected: true });
      await page.goto(`/chat/${id}`);
      await expect(
        page.getByRole("heading", { exact: true, name: "404" })
      ).toBeVisible();
      const stream = await page.request.get(
        `/api/eve/v1/session/${sessionId}/stream`,
        { headers: { "x-chatjs-deletion": "1" } }
      );
      expect(stream.status()).toBe(404);
      const publicPage = await anonymous.newPage();
      await publicPage.route("https://unpkg.com/react-scan/**", (route) =>
        route.abort()
      );
      await publicPage.goto(`${new URL(page.url()).origin}/share/${id}`);
      await expect(
        publicPage.getByRole("heading", { exact: true, name: "404" })
      ).toBeVisible();
      await expect(publicPage.getByRole("log")).toHaveCount(0);
    } finally {
      await anonymous.close();
      await db.delete(eveConversation).where(eq(eveConversation.id, id));
    }
  });
  /* oxlint-enable oxc/no-async-await */
}
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
