import { takeSnapshot } from "@uiverify/vitest";
import React, { act } from "react";
import { expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import {
  ChatLayout,
  ChatLayoutHandle,
  ChatLayoutMain,
  ChatLayoutSecondary,
} from "@/components/chat/chat-layout";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { mount, renderRoot, unmount } from "./primitive-mount";
import "./sandbox.css";

const LayoutFixture = ({
  visible,
}: {
  readonly visible: boolean;
}): React.JSX.Element => (
  <SidebarProvider defaultOpen={false}>
    <SidebarInset>
      <ChatLayout isSecondaryPanelVisible={visible}>
        <ChatLayoutMain defaultSize={visible ? "65%" : "100%"}>
          <section aria-label="Conversation" className="bg-muted h-full p-6">
            Conversation
          </section>
        </ChatLayoutMain>
        <ChatLayoutHandle aria-label="Resize document" />
        <ChatLayoutSecondary>
          <section aria-label="Document" className="h-full p-6">
            Document
          </section>
        </ChatLayoutSecondary>
      </ChatLayout>
    </SidebarInset>
  </SidebarProvider>
);

const waitForAnimationFrame = async (): Promise<void> => {
  const { promise, resolve } = Promise.withResolvers<number>();
  requestAnimationFrame(resolve);
  await promise;
};

const regionWidth = (name: string): number =>
  page.getByRole("region", { name }).element().getBoundingClientRect().width;

test("artifact panels resize, reopen, and fill the mobile viewport", async () => {
  await page.viewport(1000, 700);
  const fixture = await mount(<LayoutFixture visible />);
  try {
    await expect.poll(() => regionWidth("Conversation")).toBeGreaterThan(600);
    expect(regionWidth("Document")).toBeGreaterThan(300);
    expect(regionWidth("Document")).toBeLessThan(400);
    expect(
      page
        .getByRole("region", { name: "Document" })
        .element()
        .getBoundingClientRect().height
    ).toBeGreaterThan(690);
    const initialWidth = regionWidth("Conversation");
    await act(async () => {
      page
        .getByRole("separator", { name: "Resize document" })
        .element()
        .focus();
      await userEvent.keyboard("{ArrowRight}");
    });
    await expect
      .poll(() => regionWidth("Conversation"))
      .toBeGreaterThan(initialWidth);
    await renderRoot(fixture.root, <LayoutFixture visible={false} />);
    await expect.poll(() => regionWidth("Conversation")).toBeGreaterThan(990);
    await expect
      .element(page.getByRole("region", { name: "Document" }))
      .not.toBeInTheDocument();
    await renderRoot(fixture.root, <LayoutFixture visible />);
    await expect.poll(() => regionWidth("Document")).toBeGreaterThan(250);
    await takeSnapshot("native-artifact-panels-desktop");
    await page.elementLocator(document.body).screenshot({
      path: "__screenshots__/native-artifact-panels-desktop.png",
    });
    await act(async () => {
      await page.viewport(390, 700);
      await waitForAnimationFrame();
    });
    await expect
      .element(page.getByText("Conversation", { exact: true }))
      .not.toBeVisible();
    await expect.poll(() => regionWidth("Document")).toBeGreaterThan(380);
    await takeSnapshot("native-artifact-panels-mobile");
    await page.elementLocator(document.body).screenshot({
      path: "__screenshots__/native-artifact-panels-mobile.png",
    });
    await act(async () => {
      await page.viewport(1000, 700);
      await waitForAnimationFrame();
    });
    await expect.poll(() => regionWidth("Conversation")).toBeGreaterThan(600);
    expect(regionWidth("Document")).toBeGreaterThan(300);
    expect(regionWidth("Document")).toBeLessThan(400);
  } finally {
    await unmount(fixture);
    await page.viewport(1000, 900);
  }
});
