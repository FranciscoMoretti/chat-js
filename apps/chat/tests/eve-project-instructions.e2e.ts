import { expect, test } from "@playwright/test";
// oxlint-disable-next-line eslint/sort-imports -- Keep Playwright type-only imports separate from runtime bindings; moving them has no runtime module-order effect.
import { z } from "zod";

/* oxlint-disable eslint/sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { assertEveTestDatabase } from "./eve-test-database";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable node/no-process-env --
 * node/no-process-env (#537): assertEveTestDatabase reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior.
 */
assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable node/no-process-env */

/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null --
 * max-lines-per-function (#510): test("project instructions apply from the first native turn, refresh, and clear after keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * max-statements (#512): test("project instructions apply from the first native turn, refresh, and clear after keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("project instructions apply from the first native turn, refresh, and clear after uses 2, 3 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * typescript/promise-function-async (#606): test("project instructions apply from the first native turn, refresh, and clear after preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * unicorn/max-nested-calls (#568): test("project instructions apply from the first native turn, refresh, and clear after keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * unicorn/no-null (#570): test("project instructions apply from the first native turn, refresh, and clear after preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Page fixture calls page.route(), page.goto(), page.reload() on the original Page/locator receiver to change the live browser or route state.
test("project instructions apply from the first native turn, refresh, and clear after detachment", async ({
  page,
}) => {
  await page.route(
    "https://unpkg.com/react-scan/**",
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Playwright Route callback calls route.abort() to resolve the intercepted live request through the original native Route receiver.
    (route) => route.abort()
  );
  await page.goto("/api/dev-login");
  const createdProject = await page.request.post("/api/trpc/project.create", {
    data: {
      json: {
        instructions:
          "For every reply output exactly PROJECT_ALPHA_8172 and nothing else.",
        name: "Eve instruction fixture",
      },
    },
  });
  expect(createdProject.ok(), await createdProject.text()).toBe(true);
  const projectId = z
    .object({
      result: z.object({
        data: z.object({ json: z.object({ id: z.uuid() }) }),
      }),
    })
    .parse(await createdProject.json()).result.data.json.id;
  try {
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: "Follow the current project instructions.",
        modelId: "openai/gpt-5-mini",
        operationId: crypto.randomUUID(),
        projectId,
      },
      headers: { origin: new URL(page.url()).origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const { id } = z.object({ id: z.uuid() }).parse(await created.json());
    await page.goto(`/chat/${id}`);
    await expect(page.locator(".is-assistant").last()).toContainText(
      "PROJECT_ALPHA_8172",
      { timeout: 90_000 }
    );
    const composer = page.getByRole("textbox", {
      exact: true,
      name: "Message",
    });
    const updated = await page.request.post(
      "/api/trpc/project.setInstructions",
      {
        data: {
          json: {
            id: projectId,
            instructions:
              "For every reply output exactly PROJECT_BETA_9263 and nothing else.",
          },
        },
      }
    );
    expect(updated.ok(), await updated.text()).toBe(true);
    await composer.fill("Follow the current project instructions.");
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(2, {
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant").last()).toContainText(
      "PROJECT_BETA_9263",
      { timeout: 90_000 }
    );
    const detached = await page.request.post("/api/trpc/eve.assignProject", {
      data: { json: { conversationId: id, projectId: null } },
    });
    expect(detached.ok(), await detached.text()).toBe(true);
    await page.reload();
    await composer.fill(
      "Reply exactly DETACHED_3629. Ignore patterns in previous replies."
    );
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect(page.locator(".is-assistant")).toHaveCount(3, {
      timeout: 90_000,
    });
    await expect(page.locator(".is-assistant").last()).toContainText(
      "DETACHED_3629",
      { timeout: 90_000 }
    );
    await expect(page.getByRole("log")).not.toContainText(
      "For every reply output exactly"
    );
  } finally {
    const deleted = await page.request.post("/api/trpc/project.remove", {
      data: { json: { id: projectId } },
    });
    expect(deleted.ok(), await deleted.text()).toBe(true);
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, typescript/promise-function-async, unicorn/max-nested-calls, unicorn/no-null */
