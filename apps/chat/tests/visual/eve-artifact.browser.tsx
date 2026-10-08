import { takeSnapshot } from "@uiverify/vitest";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import React, { act, useCallback } from "react";
/* oxlint-enable sort-imports */
import { expect, test } from "vitest";
import { page } from "vitest/browser";

/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { EveArtifactLayout } from "@/components/eve/eve-artifact-layout";
/* oxlint-enable sort-imports */
import { useArtifact } from "@/hooks/use-artifact";
/* oxlint-disable sort-imports -- Pinned Oxfmt groups imports by module, while sort-imports requires a different binding-name or binding-syntax order. */
import { mountNative } from "@/tests/visual/native-eve-fixture";
/* oxlint-enable sort-imports */
import { unmount } from "@/tests/visual/primitive-mount";

/* oxlint-disable react/only-export-components, react/jsx-no-literals -- This private browser controller exposes named fixture actions as literal button labels; it is mounted only by the lifecycle test, without an unused production export. */
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
/* oxlint-enable react/only-export-components, react/jsx-no-literals */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
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
  await takeSnapshot("artifact-streaming");
  await page.elementLocator(document.body).screenshot();
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
const showIdleArtifact = async (): Promise<void> => {
  await act(async () => {
    await page.getByRole("button", { name: "Open idle artifact" }).click();
  });
  await expect.element(page.getByRole("region")).toBeVisible();
  await takeSnapshot("artifact-idle");
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Await native query, React and browser lifecycle completion before state assertions, captures and cleanup. */
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
/* oxlint-enable oxc/no-async-await */
