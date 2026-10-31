import type { ReactNode } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import ChatLayout from "@/app/(chat)/layout";
import ConnectorDetailsPage from "@/app/(chat)/settings/connectors/[connectorId]/page";
import ConnectorsPage from "@/app/(chat)/settings/connectors/page";
import SettingsLayout from "@/app/(chat)/settings/layout";
import ModelsPage from "@/app/(chat)/settings/models/page";
import GeneralPage from "@/app/(chat)/settings/page";

import {
  connectorsTrpc,
  github,
  linear,
  notion,
  sentry,
  signedIn,
  wiki,
} from "./fixtures";
import { renderRoute } from "./render";
import { TrpcFixtureError } from "./route";

const settings = (children: ReactNode) => (
  <ChatLayout>
    <SettingsLayout>{children}</SettingsLayout>
  </ChatLayout>
);
const request = (path: string) => ({
  ...signedIn,
  cookies: {},
  path,
  trpc: connectorsTrpc,
});

test("general settings", async () => {
  await renderRoute(settings(<GeneralPage />), request("/settings"));
  await expect
    .element(page.getByRole("link", { name: "Models", exact: true }).first())
    .toBeVisible();
  const navigation = [...document.querySelectorAll('a[href^="/settings"]')].map(
    (link) => link.getAttribute("href")
  );
  expect(navigation).toContain("/settings/models");
  expect(navigation).toContain("/settings/connectors");
  await expect
    .element(page.getByText("General settings will be available here soon."))
    .toBeVisible();
});

test("model settings list every available model", async () => {
  await renderRoute(settings(<ModelsPage />), request("/settings/models"));
  await expect
    .element(page.getByRole("link", { name: "Models", exact: true }).first())
    .toHaveAttribute("href", "/settings/models");
  await expect
    .element(page.getByRole("link", { name: "Models Registry" }))
    .not.toBeInTheDocument();
  await expect.element(page.getByText(/^[1-9]\d* models$/u)).toBeVisible();
  await expect.element(page.getByText("GPT-5 mini").first()).toBeVisible();
  await page.viewport(390, 844);
  await expect
    .poll(() => {
      const toggle = page.getByRole("switch").first().element();
      const viewport = toggle.closest('[data-slot="scroll-area-viewport"]');
      if (!(viewport instanceof HTMLElement)) {
        throw new Error(
          "Model preferences must remain inside their scroll area"
        );
      }
      const control = toggle.getBoundingClientRect();
      const bounds = viewport.getBoundingClientRect();
      return control.left >= bounds.left && control.right <= bounds.right;
    })
    .toBe(true);
});

test("model settings filtered by a search", async () => {
  await renderRoute(settings(<ModelsPage />), request("/settings/models"));
  await userEvent.fill(page.getByPlaceholder(/Search/u), "claude");
  await expect
    .element(page.getByText("Claude Sonnet 4", { exact: false }).first())
    .toBeVisible();
  await expect.element(page.getByText("GPT-5 nano")).not.toBeInTheDocument();
});

test("model settings with a search that matches nothing", async () => {
  await renderRoute(settings(<ModelsPage />), request("/settings/models"));
  await userEvent.fill(page.getByPlaceholder(/Search/u), "no such model");
  await expect.element(page.getByText("No models found.")).toBeVisible();
});

test("connectors in every connection state, with a built-in one", async () => {
  await renderRoute(
    settings(<ConnectorsPage />),
    request("/settings/connectors")
  );
  await expect
    .element(page.getByText("Connected", { exact: true }).first())
    .toBeVisible();
  await expect.element(page.getByText("Authorization required")).toBeVisible();
  await expect.element(page.getByText("Incompatible server")).toBeVisible();
  await expect
    .element(page.getByText("HTTP 503: Service Unavailable"))
    .toBeVisible();
  await expect.element(page.getByText("Built-in connectors")).toBeVisible();
});

test("connectors before any are added", async () => {
  await renderRoute(settings(<ConnectorsPage />), {
    ...request("/settings/connectors"),
    trpc: { ...connectorsTrpc, "mcp.list": [] },
  });
  await expect.element(page.getByText("No custom connectors")).toBeVisible();
});

test("connectors that could not load", async () => {
  await renderRoute(settings(<ConnectorsPage />), {
    ...request("/settings/connectors"),
    trpc: {
      ...connectorsTrpc,
      "mcp.list": new TrpcFixtureError(
        "INTERNAL_SERVER_ERROR",
        "The connectors service did not respond."
      ),
    },
  });
  await expect
    .element(page.getByText("Could not load connectors"))
    .toBeVisible();
});

test("adding a custom connector", async () => {
  await renderRoute(settings(<ConnectorsPage />), {
    ...request("/settings/connectors"),
    search: "dialog=config",
  });
  await expect
    .element(
      page.getByRole("dialog").getByText("Add custom connector", {
        exact: false,
      })
    )
    .toBeVisible();
});

test("connecting a connector that needs authorization", async () => {
  await renderRoute(settings(<ConnectorsPage />), {
    ...request("/settings/connectors"),
    search: `dialog=connect&connectorId=${notion.id}`,
  });
  await expect
    .element(page.getByRole("dialog").getByText("Connect Notion"))
    .toBeVisible();
});

const details = async (connectorId: string): Promise<void> => {
  await renderRoute(
    settings(
      <ConnectorDetailsPage params={Promise.resolve({ connectorId })} />
    ),
    request(`/settings/connectors/${connectorId}`)
  );
};

test("connector details list its tools and resources", async () => {
  await details(linear.id);
  await expect.element(page.getByText("create_issue")).toBeVisible();
  await expect.element(page.getByText("My issues")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Uninstall" }))
    .toBeVisible();
});

test("connector details awaiting authorization", async () => {
  await details(notion.id);
  await expect.element(page.getByText("Authorization required")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Connect", exact: true }))
    .toBeVisible();
});

test("connector details for an incompatible server", async () => {
  await details(wiki.id);
  await expect.element(page.getByText("Incompatible server")).toBeVisible();
});

test("connector details when the server cannot be reached", async () => {
  await details(sentry.id);
  await expect
    .element(page.getByText("Failed to connect to MCP server"))
    .toBeVisible();
  await expect
    .element(page.getByText("temporarily unavailable (503", { exact: false }))
    .toBeVisible();
});

test("built-in connector details, which the account cannot edit", async () => {
  await details(github.id);
  await expect.element(page.getByText("search_code")).toBeVisible();
  await expect
    .element(page.getByRole("button", { name: "Uninstall" }))
    .not.toBeInTheDocument();
});

test("connector that no longer exists", async () => {
  await details("f6c8b0d2-7a9c-4eb5-9f6b-8d0e2f4a6b7c");
  await expect.element(page.getByText("Connector not found")).toBeVisible();
});

test("connector advanced settings preserve transport labels and validation", async () => {
  await renderRoute(settings(<ConnectorsPage />), {
    ...request("/settings/connectors"),
    search: "dialog=config",
  });
  await page.getByRole("button", { name: "Advanced settings" }).click();
  const transport = page.getByRole("combobox", { name: "Transport Type" });
  await expect.element(transport).toHaveTextContent("HTTP (Streamable)");
  await transport.click();
  await page.getByRole("option", { name: "SSE (Server-Sent Events)" }).click();
  await expect.element(transport).toHaveTextContent("SSE (Server-Sent Events)");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect
    .element(page.getByRole("textbox", { name: "Name", exact: true }))
    .toHaveAttribute("aria-invalid", "true");
  await expect
    .element(page.getByText("Name is required", { exact: true }))
    .toBeVisible();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("My connector");
  await page
    .getByRole("textbox", { name: "URL", exact: true })
    .fill("https://connector.example/mcp");
  await transport.click();
  await expect
    .element(page.getByRole("option", { name: "SSE (Server-Sent Events)" }))
    .toHaveFocus();
  await userEvent.keyboard("{ArrowUp}");
  await expect
    .element(page.getByRole("option", { name: "HTTP (Streamable)" }))
    .toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect.element(transport).toHaveTextContent("HTTP (Streamable)");
  await page
    .elementLocator(document.body)
    .screenshot({ path: "__screenshots__/native-connector-fields.png" });
});
