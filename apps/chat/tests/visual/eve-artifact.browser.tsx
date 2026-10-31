import { takeSnapshot } from "@uiverify/vitest";
import React, { act, useCallback } from "react";
import { expect, test } from "vitest";
import { page } from "vitest/browser";

import { EveArtifactLayout } from "@/components/eve/eve-artifact-layout";
import { useArtifact } from "@/hooks/use-artifact";
import { mountNative } from "@/tests/visual/native-eve-fixture";
import { unmount } from "@/tests/visual/primitive-mount";

const ArtifactControls = (): React.JSX.Element => {
  const { artifact, metadata, setArtifact, setMetadata } = useArtifact();
  const start = useCallback(() => {
    setArtifact({
      content: "# Owned draft\nPreview content.",
      documentId: "init",
      isVisible: true,
      kind: "text",
      messageId: "fixture-message",
      status: "streaming",
      title: "Owned draft",
    });
  }, [setArtifact]);
  const idle = useCallback(() => {
    setArtifact({
      content: "Owned document",
      documentId: "init",
      isVisible: true,
      kind: "text",
      messageId: "fixture-message",
      status: "idle",
      title: "Owned document",
    });
  }, [setArtifact]);
  const assign = useCallback(() => {
    setMetadata({ fixtureVersion: 2 });
  }, [setMetadata]);
  return (
    <section>
      <button type="button" onClick={start}>
        Start streaming artifact
      </button>
      <button type="button" onClick={idle}>
        Open idle artifact
      </button>
      <button type="button" onClick={assign}>
        Set fixture metadata
      </button>
      <output data-testid="artifact-state">
        {JSON.stringify({ artifact, metadata })}
      </output>
    </section>
  );
};
const showStreamingArtifact = async (): Promise<void> => {
  await act(async () => {
    await page
      .getByRole("button", { name: "Start streaming artifact" })
      .click();
  });
  await expect.element(page.getByRole("region")).toBeVisible();
  await act(async () => {
    await page.getByRole("button", { name: "Set fixture metadata" }).click();
  });
  await expect
    .element(page.getByTestId("artifact-state"))
    .toHaveTextContent("fixtureVersion");
  await expect
    .element(page.getByRole("heading", { name: "Owned draft", exact: true }))
    .toBeVisible();
  await takeSnapshot("artifact-streaming");
  await page.elementLocator(document.body).screenshot();
};
const hideStreamingArtifact = async (): Promise<void> => {
  await act(async () => {
    await page.getByRole("button", { exact: true, name: "Close" }).click();
  });
  await expect.element(page.getByRole("region")).not.toBeInTheDocument();
  await expect
    .element(page.getByTestId("artifact-state"))
    .toHaveTextContent("Owned draft");
  await takeSnapshot("artifact-streaming-hidden");
};
const showIdleArtifact = async (): Promise<void> => {
  await act(async () => {
    await page.getByRole("button", { name: "Open idle artifact" }).click();
  });
  await expect.element(page.getByRole("region")).toBeVisible();
  await takeSnapshot("artifact-idle");
};
const resetIdleArtifact = async (): Promise<void> => {
  await act(async () => {
    await page.getByRole("button", { exact: true, name: "Close" }).click();
  });
  await expect.element(page.getByRole("region")).not.toBeInTheDocument();
  await expect
    .element(page.getByTestId("artifact-state"))
    .not.toHaveTextContent("Owned document");
  await takeSnapshot("artifact-idle-reset");
};
test("native artifact streaming close and idle reset", async () => {
  const state = await mountNative(
    <EveArtifactLayout conversationId="fixture-chat" readOnly>
      <ArtifactControls />
    </EveArtifactLayout>
  );
  try {
    await showStreamingArtifact();
    await hideStreamingArtifact();
    await showIdleArtifact();
    await resetIdleArtifact();
  } finally {
    await unmount(state.fixture);
    state.queryClient.clear();
  }
});
