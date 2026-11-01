import { createDomHarness } from "@/components/test-dom-harness";
import { useDocumentDraft } from "@/components/eve/use-document-draft";
import { useEveMessageDelivery } from "@/components/eve/use-eve-message-delivery";
import { eveMessageDelivery } from "@/lib/eve/message-delivery";
import React, { act, useLayoutEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { page } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";

const mutation = vi.hoisted(() => ({
  save: vi
    .fn<(_input: unknown) => Promise<{ id: string; title: string }>>()
    .mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000004",
      title: "Saved",
    }),
}));

vi.mock("@/trpc/react", () => ({
  useTRPC: () => ({ eve: { saveDocument: { mutationOptions: () => ({}) } } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useMutation: () => ({
    isPending: false,
    mutateAsync: mutation.save,
  }),
}));

const baseRevisionId = "00000000-0000-4000-8000-000000000001";
const operationId = "00000000-0000-4000-8000-000000000002";
const revision = { id: baseRevisionId, title: "Document", content: "Original" };
const savedDraft = {
  baseRevisionId,
  operationId,
  content: "Restored",
  title: "Document",
};
const onSaved = vi
  .fn<(_revisionId: string) => Promise<void>>()
  .mockResolvedValue();

const DocumentProbe = ({
  documentId,
  enabled,
  onRestore,
}: {
  readonly documentId: string;
  readonly enabled: boolean;
  readonly onRestore: (revisionId: string) => void;
}): React.JSX.Element => {
  const draft = useDocumentDraft({
    conversationId: "storage-test",
    documentId,
    enabled,
    revision,
    onSaved,
    onRestore,
  });
  return (
    <section>
      <output>
        {JSON.stringify({
          ready: draft.ready,
          content: draft.draft?.content,
          storageError: draft.storageError,
        })}
      </output>
      <button
        type="button"
        onClick={() => {
          draft.edit("Edited");
        }}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => {
          draft.discard();
        }}
      >
        Discard
      </button>
      <button
        type="button"
        onClick={() => {
          void draft.retry();
        }}
      >
        Save
      </button>
    </section>
  );
};

const DeliveryProbe = ({
  sessionId,
  earlyAck = false,
  earlyOperationId = operationId,
}: {
  readonly sessionId: string;
  readonly earlyAck?: boolean;
  readonly earlyOperationId?: string;
}): React.JSX.Element => {
  const delivery = useEveMessageDelivery(sessionId);
  const { accept } = delivery;
  useLayoutEffect(() => {
    if (earlyAck) {
      accept({
        sessionId,
        operationId: earlyOperationId,
        deliveryId: "fixture-delivery",
      });
    }
  }, [earlyAck, earlyOperationId, accept, sessionId]);
  return (
    <section>
      <output>{delivery.pending?.message ?? "empty"}</output>
      <button
        type="button"
        onClick={() => {
          delivery.accept({
            sessionId,
            operationId: baseRevisionId,
            deliveryId: "fixture-delivery",
          });
        }}
      >
        Wrong Ack
      </button>
      <button
        type="button"
        onClick={() => {
          delivery.accept({
            sessionId,
            operationId,
            deliveryId: "fixture-delivery",
          });
        }}
      >
        Ack
      </button>
    </section>
  );
};

const button = (container: HTMLElement, text: string): HTMLButtonElement => {
  const match = [...container.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === text
  );
  if (!match) {
    throw new Error(`Missing button ${text}`);
  }
  return match;
};

const mountProbe = (
  children: React.ReactNode
): ReturnType<typeof createDomHarness> => {
  let harness: ReturnType<typeof createDomHarness> | undefined;
  act(() => {
    harness = createDomHarness(children);
  });
  if (!harness) {
    throw new Error("Harness did not mount");
  }
  return harness;
};

describe("storage subscription lifecycles", (): void => {
  it("still restores a pending delivery after an early unrelated acknowledgement", (): void => {
    const sessionId = "storage-delivery-early-unrelated";
    const key = `chatjs.eve.pending-message:${sessionId}`;
    sessionStorage.setItem(
      key,
      JSON.stringify({ message: "Still pending", attachments: [], operationId })
    );
    const harness = mountProbe(
      <DeliveryProbe
        sessionId={sessionId}
        earlyAck
        earlyOperationId={baseRevisionId}
      />
    );
    try {
      expect(harness.container.textContent).toContain("Still pending");
      expect(
        eveMessageDelivery.read(sessionStorage, sessionId)?.operationId
      ).toBe(operationId);
    } finally {
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(key);
    }
  });
  it("keeps newer edits queued behind the immutable save request", async (): Promise<void> => {
    const key = "eve-document-draft:storage-test:saving";
    sessionStorage.setItem(key, JSON.stringify(savedDraft));
    const pending = Promise.withResolvers<{ id: string; title: string }>();
    mutation.save.mockReturnValueOnce(pending.promise);
    const restored = vi.fn<(_revisionId: string) => void>();
    const harness = mountProbe(
      <DocumentProbe documentId="saving" enabled onRestore={restored} />
    );
    try {
      act(() => {
        button(harness.container, "Save").click();
      });
      expect(mutation.save).toHaveBeenLastCalledWith(
        expect.objectContaining({
          content: "Restored",
          expectedRevisionId: baseRevisionId,
          operationId,
        })
      );
      act(() => {
        button(harness.container, "Edit").click();
      });
      expect(sessionStorage.getItem(key)).toContain(
        '"submittedContent":"Restored"'
      );
      await act(async () => {
        pending.resolve({
          id: "00000000-0000-4000-8000-000000000004",
          title: "Saved",
        });
        await pending.promise;
      });
      expect(sessionStorage.getItem(key)).toContain('"content":"Edited"');
      expect(sessionStorage.getItem(key)).toContain(
        '"baseRevisionId":"00000000-0000-4000-8000-000000000004"'
      );
      expect(sessionStorage.getItem(key)).not.toContain("submittedContent");
    } finally {
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(key);
    }
  });

  it("retains the edited document in memory when synchronous storage writes fail", (): void => {
    const key = "eve-document-draft:storage-test:blocked";
    sessionStorage.setItem(key, JSON.stringify(savedDraft));
    const restored = vi.fn<(_revisionId: string) => void>();
    const harness = mountProbe(
      <DocumentProbe documentId="blocked" enabled onRestore={restored} />
    );
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("Storage blocked");
      });
    try {
      act(() => {
        button(harness.container, "Edit").click();
      });
      expect(harness.container.textContent).toContain('"content":"Edited"');
      expect(harness.container.textContent).toContain('"storageError":true');
      expect(sessionStorage.getItem(key)).toContain("Restored");
    } finally {
      write.mockRestore();
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(key);
    }
  });

  it("restores document drafts only when enabled, isolates keys, and persists edits synchronously", async (): Promise<void> => {
    const key = "eve-document-draft:storage-test:first";
    const secondKey = "eve-document-draft:storage-test:second";
    sessionStorage.setItem(key, JSON.stringify(savedDraft));
    sessionStorage.setItem(
      secondKey,
      JSON.stringify({ ...savedDraft, content: "Second" })
    );
    const restored = vi.fn<(_revisionId: string) => void>();
    const harness = mountProbe(
      <DocumentProbe documentId="first" enabled={false} onRestore={restored} />
    );
    try {
      expect(restored).not.toHaveBeenCalled();
      expect(harness.container.textContent).toContain('"ready":false');
      act(() => {
        harness.update(
          <DocumentProbe documentId="first" enabled onRestore={restored} />
        );
      });
      expect(restored).toHaveBeenCalledExactlyOnceWith(baseRevisionId);
      expect(harness.container.textContent).toContain("Restored");
      act(() => {
        button(harness.container, "Edit").click();
        expect(sessionStorage.getItem(key)).toContain('"content":"Edited"');
      });
      act(() => {
        harness.update(
          <DocumentProbe documentId="second" enabled onRestore={restored} />
        );
      });
      expect(harness.container.textContent).toContain("Second");
      expect(restored).toHaveBeenCalledTimes(2);
      await page.screenshot();
      act(() => {
        button(harness.container, "Discard").click();
      });
      expect(sessionStorage.getItem(secondKey)).toBeNull();
      expect(sessionStorage.getItem(key)).toContain("Edited");
    } finally {
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(key);
      sessionStorage.removeItem(secondKey);
    }
  });

  it("hydrates the empty server snapshot before restoring tab-local state", (): void => {
    const documentKey = "eve-document-draft:storage-test:hydrate";
    const deliveryKey = "chatjs.eve.pending-message:storage-delivery-hydrate";
    sessionStorage.setItem(documentKey, JSON.stringify(savedDraft));
    sessionStorage.setItem(
      deliveryKey,
      JSON.stringify({
        message: "Hydrated pending",
        attachments: [],
        operationId,
      })
    );
    const restored = vi.fn<(_revisionId: string) => void>();
    const children = (
      <>
        <DocumentProbe documentId="hydrate" enabled onRestore={restored} />
        <DeliveryProbe sessionId="storage-delivery-hydrate" />
      </>
    );
    const markup = renderToString(children);
    expect(markup).toContain("&quot;ready&quot;:false");
    expect(markup).not.toContain("Restored");
    expect(markup).not.toContain("Hydrated pending");
    const container = document.createElement("main");
    container.append(document.createRange().createContextualFragment(markup));
    document.body.append(container);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot> | undefined;
    act(() => {
      root = hydrateRoot(container, children, {
        onRecoverableError: (error: unknown): void => {
          errors.push(error);
        },
      });
    });
    try {
      expect(errors).toEqual([]);
      expect(container.textContent).toContain("Restored");
      expect(container.textContent).toContain("Hydrated pending");
      expect(restored).toHaveBeenCalledExactlyOnceWith(baseRevisionId);
    } finally {
      act(() => {
        root?.unmount();
      });
      container.remove();
      sessionStorage.removeItem(documentKey);
      sessionStorage.removeItem(deliveryKey);
    }
  });

  it("reports corrupt document storage without restoring an invalid revision", (): void => {
    const key = "eve-document-draft:storage-test:corrupt";
    sessionStorage.setItem(key, "invalid JSON");
    const restored = vi.fn<(_revisionId: string) => void>();
    const harness = mountProbe(
      <DocumentProbe documentId="corrupt" enabled onRestore={restored} />
    );
    try {
      expect(restored).not.toHaveBeenCalled();
      expect(harness.container.textContent).toContain('"ready":true');
      expect(harness.container.textContent).toContain('"storageError":true');
    } finally {
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(key);
    }
  });

  it("restores pending delivery per session and only clears a matching acknowledgement", (): void => {
    const first = "storage-delivery-first";
    const second = "storage-delivery-second";
    sessionStorage.setItem(
      `chatjs.eve.pending-message:${first}`,
      JSON.stringify({ message: "First pending", attachments: [], operationId })
    );
    const other = eveMessageDelivery.begin(sessionStorage, second, {
      message: "Second pending",
      attachments: [],
    });
    const harness = mountProbe(<DeliveryProbe sessionId={first} />);
    try {
      expect(harness.container.textContent).toContain("First pending");
      act(() => {
        button(harness.container, "Wrong Ack").click();
      });
      expect(eveMessageDelivery.read(sessionStorage, first)?.operationId).toBe(
        operationId
      );
      act(() => {
        button(harness.container, "Ack").click();
      });
      expect(harness.container.textContent).toContain("empty");
      expect(eveMessageDelivery.read(sessionStorage, first)).toBeNull();
      act(() => {
        harness.update(<DeliveryProbe sessionId={second} />);
      });
      expect(harness.container.textContent).toContain("Second pending");
      expect(eveMessageDelivery.read(sessionStorage, second)?.operationId).toBe(
        other.operationId
      );
    } finally {
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(`chatjs.eve.pending-message:${first}`);
      sessionStorage.removeItem(`chatjs.eve.pending-message:${second}`);
    }
  });

  it("does not resurrect a delivery acknowledged before passive subscriptions", (): void => {
    const sessionId = "storage-delivery-early";
    sessionStorage.setItem(
      `chatjs.eve.pending-message:${sessionId}`,
      JSON.stringify({
        message: "Already received",
        attachments: [],
        operationId,
      })
    );
    const harness = mountProbe(
      <DeliveryProbe sessionId={sessionId} earlyAck />
    );
    try {
      expect(harness.container.textContent).toContain("empty");
      expect(eveMessageDelivery.read(sessionStorage, sessionId)).toBeNull();
    } finally {
      act(() => {
        harness.unmount();
      });
      sessionStorage.removeItem(`chatjs.eve.pending-message:${sessionId}`);
    }
  });
});
