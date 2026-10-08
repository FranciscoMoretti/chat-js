/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema"; "../lib/eve/connection-options" dependency within this package instead of introducing an alias or barrel API.
 */

import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import required by consistent-type-imports; it has no runtime evaluation order.
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.
import { eq } from "drizzle-orm";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Client } from "eve/client";
// oxlint-disable-next-line eslint/sort-imports -- Keep the type-only import separate from runtime bindings; it has no runtime module-order effect.
import type { MessageStreamEvent } from "eve/client";
/* oxlint-enable eslint/sort-imports */
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { db } from "../lib/db/client";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveConversation, user } from "../lib/db/schema";
/* oxlint-enable eslint/sort-imports */
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { insertEveConversationFixtures } from "./eve-conversation-fixture";
/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
type SharingEventReader =
  | {
      readonly type: "message.completed";
      readonly data: {
        readonly finishReason: string;
        readonly message?: string | null;
      };
    }
  | {
      readonly type: Exclude<MessageStreamEvent["type"], "message.completed">;
      readonly data?: unknown;
    };
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * max-lines-per-function (#510): test("sharing exposes only a read-only transcript, enforces ownership and revokes the keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("sharing exposes only a read-only transcript, enforces ownership and revokes the keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("sharing exposes only a read-only transcript, enforces ownership and revokes the uses 10_000, 1000, 2000, 4000, 0, 401, 404 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("sharing exposes only a read-only transcript, enforces ownership and revokes the preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): test("sharing exposes only a read-only transcript, enforces ownership and revokes the intentionally keeps the existing falsy-value behavior of owner; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), locator.click() on the original Page/locator receiver to change the live browser or route state.
test("sharing exposes only a read-only transcript, enforces ownership and revokes the link", async ({
  page,
  browser,
}) => {
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message:
        "Reply exactly share-fixture-ok as plain text. Do not call tools.",
      modelId: "google/gemini-2.5-flash-lite",
      operationId: crypto.randomUUID(),
    },
    headers: { origin: new URL(page.url()).origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const binding = z
    .object({ id: z.uuid(), sessionId: z.string() })
    .parse(await created.json());
  const anonymous = await browser.newContext();
  const publicPage = await anonymous.newPage();
  await publicPage.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  const foreignId = crypto.randomUUID();
  const foreignChat = crypto.randomUUID();
  await db.insert(user).values({
    email: `${foreignId}@test.invalid`,
    id: foreignId,
    name: "Share ownership fixture",
  });
  await insertEveConversationFixtures({
    firstMessage: "Private foreign conversation",
    id: foreignChat,
    operationId: crypto.randomUUID(),
    ownerId: foreignId,
  });
  try {
    const base = new URL(page.url()).origin;
    await publicPage.goto(`${base}/share/${binding.id}`);
    await expect(
      publicPage.getByRole("heading", { exact: true, name: "404" })
    ).toBeVisible();
    await page.goto(`/chat/${binding.id}`);
    await expect(page.locator(".is-assistant")).toContainText(
      "share-fixture-ok",
      { timeout: 90_000 }
    );
    const [owner] = await db
      .select({ id: eveConversation.ownerId })
      .from(eveConversation)
      .where(eq(eveConversation.id, binding.id));
    if (!owner) {
      throw new Error("Missing fixture owner.");
    }
    const native = new Client(
      getEveConnectionOptions(owner.id)
    ).sessions.attach(binding.sessionId);
    // Tool input can contain the same marker before an answer exists.
    await expect
      .poll(
        async () => {
          const snapshot = await native.snapshot({
            signal: AbortSignal.timeout(10_000),
          });
          return snapshot.events.some(
            (event: SharingEventReader) =>
              event.type === "message.completed" &&
              event.data.finishReason === "stop" &&
              // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading trim from event.data.message; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
              event.data.message?.trim() === "share-fixture-ok"
          );
        },
        { intervals: [1000, 2000, 4000], timeout: 30_000 }
      )
      .toBe(true);
    await page.getByRole("button", { exact: true, name: "Share chat" }).click();
    await expect(page.getByRole("dialog")).toContainText("Private");
    await expect(
      page.getByRole("button", { exact: true, name: "Share Chat" })
    ).toBeEnabled();
    await page.getByRole("dialog").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-share-private.png",
    });
    await page.getByRole("button", { exact: true, name: "Share Chat" }).click();
    await expect(
      page.getByRole("button", { exact: true, name: "Make Private" })
    ).toBeEnabled();
    await page.getByRole("dialog").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-share-public.png",
    });
    await publicPage.reload();
    await expect(publicPage.getByRole("log")).toContainText("share-fixture-ok");
    await expect(publicPage.getByTestId("multimodal-input")).toHaveCount(0);
    await publicPage.locator("main").screenshot({
      animations: "disabled",
      path: "tests/eve-results/screenshots/eve-shared-transcript.png",
    });
    const forbidden = await publicPage.request.post(
      `${base}/api/trpc/eve.setVisibility`,
      { data: { json: { id: binding.id, visibility: "private" } } }
    );
    expect(forbidden.status()).toBe(401);
    const foreign = await page.request.post("/api/trpc/eve.setVisibility", {
      data: { json: { id: foreignChat, visibility: "public" } },
    });
    expect(foreign.status()).toBe(404);
    const stream = await publicPage.request.get(
      `${base}/api/eve/v1/session/${binding.sessionId}/stream`
    );
    expect(stream.status()).toBe(401);
    await page
      .getByRole("button", { exact: true, name: "Make Private" })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await publicPage.reload();
    await expect(
      publicPage.getByRole("heading", { exact: true, name: "404" })
    ).toBeVisible();
    await expect(publicPage.getByRole("log")).toHaveCount(0);
  } finally {
    await db
      .update(eveConversation)
      .set({ visibility: "private" })
      .where(eq(eveConversation.id, binding.id));
    await anonymous.close();
    await db.delete(eveConversation).where(eq(eveConversation.id, foreignChat));
    await db.delete(user).where(eq(user.id, foreignId));
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions */
