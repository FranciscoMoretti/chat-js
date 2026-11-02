import { expect, test } from "vitest";
import { page } from "vitest/browser";
import ControllerPage from "@/app/create-controller/page";
import { renderRoute } from "./render";

// The same route also has Playwright interaction coverage against Next.js.
test("Create uses the installed Feedback and Projects controllers", async () => {
  await renderRoute(<ControllerPage />, { path: "/create-controller" });
  await expect
    .element(
      page.getByRole("heading", { name: "A small start. A great experience." })
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("link", { name: "Launch plan" }))
    .toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Upvote Response" }))
    .toBeEnabled();
});
