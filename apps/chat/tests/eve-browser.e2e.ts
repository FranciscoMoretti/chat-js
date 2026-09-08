import { mkdir } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";

const conversationUrl = /conversation=/;
const failureMessage = /failure|failed/i;
const connectionFailure = /fetch|failed/i;

async function capture(page: Page, name: string) {
  await mkdir("tests/eve-results/screenshots", { recursive: true });
  await page.screenshot({
    path: `tests/eve-results/screenshots/${name}.png`,
    animations: "disabled",
    style:
      "nextjs-portal, #react-scan-toolbar, #react-scan-root { visibility: hidden !important; }",
  });
}

test.beforeEach(async ({ page }) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  await page.goto("/agent");
  await expect(
    page.getByRole("heading", { name: "Agent chat", exact: true })
  ).toBeVisible();
});

async function create(page: Page, message: string) {
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(message);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(conversationUrl);
}

test("native transcript survives reload; streaming preserves the next draft; cancellation permits another send", async ({
  page,
}) => {
  await capture(page, "empty-desktop");
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("slow response");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.getByText("Responding…", { exact: true })).toBeVisible();
  await composer.fill("my next draft");
  await capture(page, "streaming-desktop");
  await expect(
    page.getByText("Verified: slow response", { exact: true })
  ).toBeVisible();
  await expect(composer).toHaveValue("my next draft");
  await composer.fill("slow cancel");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Stop", exact: true })
  ).toBeEnabled();
  const cancellation = page.waitForResponse((response) =>
    response.url().endsWith("/cancel")
  );
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  expect(await (await cancellation).json()).toMatchObject({
    ok: true,
    status: "accepted",
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  await composer.fill("after cancellation");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Verified: after cancellation", { exact: true })
  ).toBeVisible();
  await capture(page, "conversation-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await capture(page, "conversation-mobile");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
});

test("freeform agent question survives reload and accepts an answer", async ({
  page,
}) => {
  await create(page, "question");
  await expect(
    page.getByRole("textbox", { name: "Your answer" })
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("textbox", { name: "Your answer" })
    .fill("Ship on Friday");
  await capture(page, "question-pending");
  await page.getByRole("button", { name: "Submit answer" }).click();
  await expect(
    page.getByText("Answer received.", { exact: true })
  ).toBeVisible();
});

for (const decision of ["Approve", "Cancel"]) {
  test(`pending tool survives reload and ${decision.toLowerCase()} completes`, async ({
    page,
  }) => {
    await create(page, "confirm release");
    await expect(
      page.getByText("Waiting for your input", { exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByText("Waiting for your input", { exact: true })
    ).toBeVisible();
    await capture(page, `approval-${decision.toLowerCase()}`);
    await page.getByRole("button", { name: decision, exact: true }).click();
    await expect(
      page.getByText("Approval handled.", { exact: true })
    ).toBeVisible();
    await expect(
      page.getByText(
        decision === "Approve" ? "Note confirmed." : "Request declined.",
        { exact: true }
      )
    ).toBeVisible();
    await capture(page, `tool-${decision.toLowerCase()}`);
  });
}

test("failed turn is visible and the conversation can continue", async ({
  page,
}) => {
  await create(page, "hello");
  await expect(
    page.getByText("Verified: hello", { exact: true })
  ).toBeVisible();
  const composer = page.getByRole("textbox", { name: "Message", exact: true });
  await composer.fill("fail");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: failureMessage })
  ).toBeVisible();
  await expect(composer).toHaveValue("fail");
  await capture(page, "failed-turn");
  await page.reload();
  await expect(
    page.getByRole("alert").filter({ hasText: failureMessage })
  ).toBeVisible();
  await composer.fill("recovered");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByText("Verified: recovered", { exact: true })
  ).toBeVisible();
});

test("lost creation reply retries the same conversation and access checks reject bypasses", async ({
  page,
  browser,
  baseURL,
}) => {
  let acceptedId: string | undefined;
  await page.route("**/api/agent-conversations", async (route) => {
    const response = await route.fetch();
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "id" in body &&
      typeof body.id === "string"
    ) {
      acceptedId = body.id;
    }
    await route.abort("failed");
    await page.unroute("**/api/agent-conversations");
  });
  await page
    .getByRole("textbox", { name: "Message", exact: true })
    .fill("retained intent");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: connectionFailure })
  ).toBeVisible();
  await capture(page, "creation-interrupted");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}/agent?conversation=${acceptedId}`);
  await expect(
    page.getByText("Verified: retained intent", { exact: true })
  ).toBeVisible();

  const origin = new URL(baseURL ?? "http://localhost").origin;
  const rawCreate = await page.request.post("/api/eve/v1/session", {
    headers: { origin },
    data: { message: "bypass" },
  });
  expect(rawCreate.status()).toBe(404);
  const foreign = await page.request.get(
    "/api/eve/v1/session/foreign/stream?includeTailIndex=1"
  );
  expect(foreign.status()).toBe(404);
  const crossOrigin = await page.request.post("/api/agent-conversations", {
    headers: { origin: "https://evil.test" },
    data: { operationId: crypto.randomUUID(), message: "bypass" },
  });
  expect(crossOrigin.status()).toBe(403);
  const invalid = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: { operationId: crypto.randomUUID(), message: " " },
  });
  expect(invalid.status()).toBe(400);
  const anonymous = await browser.newContext({ baseURL });
  try {
    const denied = await anonymous.request.post("/api/agent-conversations", {
      headers: { origin },
      data: { operationId: crypto.randomUUID(), message: "bypass" },
    });
    expect(denied.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
});
