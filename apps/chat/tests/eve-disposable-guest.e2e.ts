import { expect, test } from "@playwright/test";
import { z } from "zod";

const bindingSchema = z.object({
  credential: z.string(),
  sessionId: z.string(),
});

test("guest chat works without application storage and disappears on reload", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.route("**/react-scan/**", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" })
  );
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) =>
    requests.push(new URL(request.url()).pathname)
  );
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await expect(page.getByText("Temporary chat", { exact: true })).toHaveCount(
    0
  );
  await expect(page.getByRole("link", { name: /New Chat/u })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open documentation" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /logo/u })).toBeVisible();
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-empty.png"),
  });
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill("Reply with exactly: temporary chat works");
  const creation = page.waitForResponse((response) =>
    response.url().endsWith("/api/eve-guest")
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  const response = await creation;
  expect(response.status()).toBe(200);
  expect(response.headers()["set-cookie"]).toBeUndefined();
  const binding = bindingSchema.parse(await response.json());
  await expect(page.getByRole("log").locator(".is-assistant")).toContainText(
    "temporary chat works",
    { timeout: 90_000 }
  );
  await expect(page).toHaveURL(/\/$/u);
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-response.png"),
  });
  const stream = `/eve/guest/v1/session/${binding.sessionId}/stream?includeTailIndex=1`;
  const unauthenticated = await page.request.get(stream);
  const otherSession = await page.request.get(
    stream.replace(binding.sessionId, "someone-else"),
    { headers: { authorization: `Bearer ${binding.credential}` } }
  );
  expect(unauthenticated.status()).toBe(401);
  expect(otherSession.status()).toBe(401);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  expect(
    requests.some(
      (path) =>
        path.startsWith("/api/trpc") ||
        path.startsWith("/api/agent-conversations")
    )
  ).toBe(false);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(page.getByRole("log")).toHaveCount(0);
  await expect(page).toHaveURL(/\/$/u);
  expect(errors).toEqual([]);
});

test("guest bootstrap failures preserve the draft and expired sessions offer a fresh start", async ({
  page,
}, testInfo) => {
  await page.route("**/react-scan/**", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" })
  );
  await page.route("**/api/eve-guest", (route) =>
    route.fulfill({ json: { error: "Unavailable" }, status: 502 })
  );
  await page.goto("/");
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Keep this draft");
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Could not start chat" })
  ).toBeVisible();
  await expect(composer).toHaveText("Keep this draft");
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-bootstrap-error.png"),
  });
  await page.unroute("**/api/eve-guest");
  await page.route("**/api/eve-guest", (route) =>
    route.fulfill({
      json: {
        credential: "expired-fixture",
        expiresAt: 0,
        sessionId: "expired-session",
      },
    })
  );
  await page.route("**/eve/guest/v1/session/**", (route) =>
    route.fulfill({
      json: { error: "This temporary chat has expired." },
      status: 401,
    })
  );
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect(
    page.getByText("This chat has expired. Start a new chat to continue.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { exact: true, name: "Send" })
  ).toBeDisabled();
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-expired-mobile.png"),
  });
  await page.getByRole("button", { exact: true, name: "New chat" }).click();
  await expect(
    page.getByRole("heading", { name: "How can I help you today?" })
  ).toBeVisible();
  await expect(
    page.getByRole("alert").filter({ hasText: "expired" })
  ).toHaveCount(0);
});

test("guest shell keeps release controls and New Chat clears the in-memory draft", async ({
  page,
}, testInfo) => {
  await page.route("**/react-scan/**", (route) =>
    route.fulfill({ body: "", contentType: "text/javascript" })
  );
  await page.goto("/");
  const composer = page.getByRole("textbox", { exact: true, name: "Message" });
  await composer.fill("Discard this draft");
  await page.getByRole("link", { name: /New Chat/u }).click();
  await expect(composer).toHaveText("");
  await composer.fill("Discard with shortcut");
  await composer.press("ControlOrMeta+Shift+O");
  await expect(composer).toHaveText("");
  await page.getByRole("button", { name: /logo/u }).click();
  await expect(page.getByRole("combobox")).toBeVisible();
  await page.addStyleTag({
    content: "nextjs-portal { display:none !important; }",
  });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-model-picker.png"),
  });
  await page.keyboard.press("Escape");
  await page.setViewportSize({ height: 844, width: 390 });
  await page.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("guest-welcome-mobile.png"),
  });
});
