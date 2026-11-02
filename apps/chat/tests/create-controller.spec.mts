import { test, expect } from "@uiverify/playwright";

// Same production controllers, exercised through their real slots and terminal transport.
for (const mobile of [false, true]) {
  test(`shared controllers ${mobile ? "mobile dark" : "desktop light"}`, async ({
    page,
    uiVerify,
  }) => {
    const backendRequests: string[] = [];
    page.on("request", (request) => {
      if (/\/api\/(?:trpc|auth)|\/eve\//u.test(request.url())) {
        backendRequests.push(request.url());
      }
    });
    await page.setViewportSize({
      width: mobile ? 390 : 1280,
      height: mobile ? 1000 : 1050,
    });
    await page.emulateMedia({ colorScheme: mobile ? "dark" : "light" });
    await page.goto("/create-controller");
    await expect(page.getByTestId("message-upvote")).toBeEnabled();
    await page.addStyleTag({
      content:
        "nextjs-portal { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; }",
    });
    await page.evaluate(async () => await document.fonts.ready);
    await page.getByTestId("message-upvote").click();
    await expect(page.getByTestId("message-upvote")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.getByTestId("message-downvote").click();
    await expect(page.getByTestId("message-downvote")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await page.getByRole("button", { name: "Conversation actions" }).click();
    await page.getByRole("menuitem", { name: "Move to project" }).click();
    await expect(
      page.getByRole("dialog", { name: "Move to project" })
    ).toBeVisible();
    await page
      .getByLabel("Project", { exact: true })
      .selectOption({ label: "Launch plan" });
    await uiVerify.snapshot("move-dialog");
    await page.getByRole("button", { name: "Move", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Move to project" })
    ).toBeHidden();
    await expect(
      page
        .getByRole("navigation", { name: "breadcrumb" })
        .getByRole("link", { name: "Launch plan" })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    if (mobile) {
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    }
    await expect(
      page.locator("a[data-active]", { hasText: "Launch plan" })
    ).toBeVisible();
    await uiVerify.snapshot("assigned");
    if (mobile) {
      await page.keyboard.press("Escape");
    }
    await page
      .getByRole("checkbox", { name: "feedback", exact: true })
      .uncheck();
    await expect(page.getByTestId("message-upvote")).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "projects", exact: true })
      .uncheck();
    await expect(
      page.getByRole("button", { name: "Conversation actions" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "breadcrumb" }).locator("a[href]")
    ).toHaveCount(0);
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get("installation")?.includes('"plugins":[]') === true
    );
    await page.reload();
    await expect(
      page.getByRole("checkbox", { name: "projects", exact: true })
    ).not.toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "feedback", exact: true })
    ).not.toBeChecked();
    await expect(page.getByTestId("create-command")).toContainText(
      "--no-projects"
    );
    await page.getByRole("checkbox", { name: "projects", exact: true }).check();
    await page.getByRole("checkbox", { name: "feedback", exact: true }).check();
    await expect(page.getByTestId("message-upvote")).toBeEnabled();
    await expect(page.getByTestId("message-upvote")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    await expect(page.getByTestId("create-command")).toContainText(
      "--projects"
    );
    expect(backendRequests).toEqual([]);
  });
}

test("production mutation errors retain the dialog and do not invent membership", async ({
  page,
  uiVerify,
}) => {
  await page.setViewportSize({ width: 1280, height: 1050 });
  await page.goto("/create-controller?scenario=mutation-error");
  await page.getByTestId("message-upvote").click();
  await expect(
    page.getByText("Failed to upvote response.", { exact: true })
  ).toBeVisible();
  await expect(page.getByTestId("message-upvote")).toHaveAttribute(
    "aria-pressed",
    "false"
  );
  await page.getByRole("button", { name: "Conversation actions" }).click();
  await page.getByRole("menuitem", { name: "Move to project" }).click();
  await page
    .getByLabel("Project", { exact: true })
    .selectOption({ label: "Launch plan" });
  await page.getByRole("button", { name: "Move", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "Could not move the conversation. Try again."
  );
  await expect(
    page.getByRole("navigation", { name: "breadcrumb" }).getByRole("link")
  ).toHaveCount(0);
  await page.addStyleTag({
    content: "nextjs-portal { display: none !important; }",
  });
  await uiVerify.snapshot("failed-move");
});
