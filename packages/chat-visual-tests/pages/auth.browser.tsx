import { expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import DeviceLoginPage from "@/app/(auth)/device-login/page";
import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import { ELECTRON_AUTH_CLIENT_ID } from "@/plugins/desktop/protocol";

import { session } from "./fixtures";
import { renderRoute } from "./render";

const desktopTransfer = `client_id=${ELECTRON_AUTH_CLIENT_ID}&state=visual`;

test("login offers every configured provider", async () => {
  await renderRoute(<LoginPage />, {
    path: "/login",
  });
  await expect.element(page.getByText("Welcome back")).toBeVisible();
  await Promise.all(
    ["Google", "GitHub", "Vercel"].map(async (provider) => {
      await expect
        .element(
          page.getByRole("button", { name: `Continue with ${provider}` })
        )
        .toBeVisible();
    })
  );
});

test("login from the desktop app hands over the signed-in account", async () => {
  await renderRoute(<LoginPage />, {
    path: "/login",
    search: desktopTransfer,
    session,
  });
  await expect.element(page.getByText(session.user.email)).toBeVisible();
});

test("login remembers the provider used last", async () => {
  await renderRoute(<LoginPage />, {
    lastLoginMethod: "github",
    path: "/login",
  });
  await expect.element(page.getByText("Last used")).toBeVisible();
});

test("login inside the desktop app sends the user to the browser", async () => {
  // The desktop app's preload script exposes this to the pages it opens.
  vi.stubGlobal("requestAuth", () => null);
  await renderRoute(<LoginPage />, {
    path: "/login",
  });
  await expect
    .element(page.getByText("Continue in browser").first())
    .toBeVisible();
});

test("register inside the desktop app sends the user to the browser", async () => {
  vi.stubGlobal("requestAuth", () => null);
  await renderRoute(<RegisterPage />, { path: "/register" });
  await expect
    .element(page.getByText("Continue in browser").first())
    .toBeVisible();
});

test("register", async () => {
  await renderRoute(<RegisterPage />, { path: "/register" });
  await expect.element(page.getByText("Create an account")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: /GitHub/u }))
    .toBeVisible();
});

test("device login while opening the desktop app", async () => {
  await renderRoute(
    <DeviceLoginPage
      searchParams={Promise.resolve(
        Object.fromEntries(new URLSearchParams(desktopTransfer))
      )}
    />,
    { path: "/device-login", search: desktopTransfer, session }
  );
  await expect
    .element(page.getByText("Opening the desktop app..."))
    .toBeVisible();
});

test("device login once the desktop app has the session", async () => {
  await renderRoute(
    <DeviceLoginPage searchParams={Promise.resolve({ done: "1" })} />,
    { path: "/device-login", search: "done=1" }
  );
  await expect.element(page.getByText("You're signed in")).toBeVisible();
});
