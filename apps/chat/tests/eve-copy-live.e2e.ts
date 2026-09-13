/* oxlint-disable eslint/sort-keys -- Fixture field order mirrors serialized protocol and persistence payloads. */
/* oxlint-disable unicorn/no-await-expression-member -- Direct awaited assertions keep each test action tied to its expectation. */
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";

import { db } from "../lib/db/client";
import {
  eveConversation,
  eveConversationCopy,
  eveFileReference,
} from "../lib/db/schema";
import { env } from "../lib/env";
import {
  conversationBinding,
  createConversationInput,
} from "../lib/eve/contracts";
import { eveCopyInput } from "../lib/eve/copy-input";
import { prepareEveCopyTranscript } from "../lib/eve/copy-transcript";
import { textPdf } from "./eve-attachment-fixtures";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(env.DATABASE_URL);
const modelId = "google/gemini-2.5-flash-lite";

test("saves without generation, recovers after source revocation and reload, and continues the native copy", async ({
  page,
  browser,
}, testInfo) => {
  await page.route("https://unpkg.com/react-scan/**", (route) => route.abort());
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", { data: { model: modelId } });
  const created = await page.request.post("/api/agent-conversations", {
    data: {
      message: "Reply exactly COPY-ORCHID as plain text. Do not call tools.",
      modelId,
      operationId: crypto.randomUUID(),
    },
    headers: { origin },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  const [sourceRow] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  const native = new Client({
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": sourceRow.ownerId },
    host: env.EVE_INTERNAL_ORIGIN ?? "",
  });
  await expect
    .poll(
      async () => {
        const snapshot = await native.sessions
          .attach(source.sessionId)
          .snapshot();
        return (
          snapshot.events.some((event) => event.type === "session.waiting") &&
          snapshot.events.some(
            (event) =>
              event.type === "message.completed" &&
              event.data.message?.trim() === "COPY-ORCHID"
          )
        );
      },
      { intervals: [1000, 2000, 4000], timeout: 30_000 }
    )
    .toBe(true);
  await db
    .update(eveConversation)
    .set({ visibility: "public" })
    .where(eq(eveConversation.id, source.id));
  const anonymous = await browser.newContext();
  try {
    const publicPage = await anonymous.newPage();
    await publicPage.goto(`${origin}/share/${source.id}`);
    await expect(
      publicPage.getByRole("link", {
        name: "Sign in to save this conversation",
      })
    ).toBeVisible();
    await publicPage
      .getByRole("link", { name: "Sign in to save this conversation" })
      .screenshot({
        animations: "disabled",
        path: testInfo.outputPath("copy-anonymous.png"),
      });
  } finally {
    await anonymous.close();
  }
  await page.goto(`/share/${source.id}`);
  const save = page.getByRole("region", { name: "Save shared conversation" });
  await expect(
    save.getByRole("button", { name: "Save to your chats" })
  ).toBeEnabled();
  await save.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-ready.png"),
  });
  let rejectedOperation: string | undefined;
  await page.route("**/api/agent-conversation-copies", async (route) => {
    rejectedOperation = eveCopyInput.parse(
      route.request().postDataJSON()
    ).operationId;
    await route.fulfill({
      json: { error: "This copy is no longer available.", retryable: false },
      status: 409,
    });
  });
  await save.getByRole("button", { name: "Save to your chats" }).click();
  await expect(
    save.getByRole("button", { name: "Save another copy" })
  ).toBeEnabled();
  await save.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-rejected.png"),
  });
  await page.unroute("**/api/agent-conversation-copies");
  const copied = Promise.withResolvers<z.infer<typeof conversationBinding>>();
  const held = Promise.withResolvers<undefined>();
  const started = Promise.withResolvers<undefined>();
  await page.route("**/api/agent-conversation-copies", async (route) => {
    const input = eveCopyInput.parse(route.request().postDataJSON());
    expect(input.modelId).toBe(modelId);
    expect(input.operationId).not.toBe(rejectedOperation);
    started.resolve(undefined);
    await held.promise;
    try {
      const response = await route.fetch();
      expect(response.ok(), await response.text()).toBe(true);
      copied.resolve(conversationBinding.parse(await response.json()));
      await route.abort();
    } catch (error) {
      copied.reject(error);
      throw error;
    }
  });
  await save.getByRole("button", { name: "Save another copy" }).click();
  await started.promise;
  try {
    await expect(
      save.getByRole("button", { name: "Saving..." })
    ).toBeDisabled();
    await save.screenshot({
      animations: "disabled",
      path: testInfo.outputPath("copy-pending.png"),
    });
  } finally {
    held.resolve(undefined);
  }
  const destination = await copied.promise;
  await expect(save.getByRole("alert")).toBeVisible();
  await save.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-lost-reply.png"),
  });
  await page.unroute("**/api/agent-conversation-copies");
  const snapshot = await native.sessions
    .attach(destination.sessionId)
    .snapshot();
  expect(snapshot.events.some((event) => event.type === "history.seeded")).toBe(
    true
  );
  expect(
    snapshot.events.some(
      (event) =>
        event.type === "session.started" ||
        event.type === "turn.started" ||
        event.type === "actions.requested"
    )
  ).toBe(false);
  // Reproduce a crash after native acceptance but before application binding commits.
  const seed = {
    ...prepareEveCopyTranscript(snapshot.events).seed,
    attachments: "channel",
  };
  await db.transaction(async (tx) => {
    await tx
      .update(eveConversation)
      .set({ sessionId: null, state: "uncertain" })
      .where(eq(eveConversation.id, destination.id));
    await tx
      .update(eveConversationCopy)
      .set({ phase: "accepted", seed: { ...seed, attachments: "channel" } })
      .where(eq(eveConversationCopy.conversationId, destination.id));
  });
  await db
    .update(eveConversation)
    .set({ visibility: "private" })
    .where(eq(eveConversation.id, source.id));
  await page.goto(`/chat/${destination.id}`);
  await page.reload();
  const recovery = page.getByRole("region", { name: "Saved copy recovery" });
  await expect(
    recovery.getByRole("button", { name: "Retry saving" })
  ).toBeEnabled();
  await recovery.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-recovery.png"),
  });
  await page.setViewportSize({ height: 844, width: 390 });
  await recovery.screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-recovery-mobile.png"),
  });
  await page.setViewportSize({ height: 720, width: 1280 });
  await recovery.getByRole("button", { name: "Retry saving" }).click();
  await expect(
    page.getByRole("textbox", { exact: true, name: "Message" })
  ).toBeVisible();
  const [bound] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, destination.id));
  expect(bound.sessionId).toBe(destination.sessionId);
  const beforeHydration = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const coldPage = await beforeHydration.newPage();
    await coldPage.goto(`${origin}/chat/${destination.id}`);
    await expect(
      coldPage.getByLabel("Message", { exact: true })
    ).toHaveAttribute("contenteditable", "false");
  } finally {
    await beforeHydration.close();
  }
  await page
    .getByRole("textbox", { exact: true, name: "Message" })
    .fill(
      "What token was in your previous answer? Reply only with the token. Do not call tools."
    );
  await page.getByRole("group", { name: "Message composer" }).screenshot({
    animations: "disabled",
    path: testInfo.outputPath("copy-composer-ready.png"),
  });
  await page.getByRole("button", { exact: true, name: "Send" }).click();
  await expect
    .poll(
      async () => {
        const continued = await native.sessions
          .attach(destination.sessionId)
          .snapshot();
        return continued.events.some(
          (event) =>
            event.type === "message.completed" &&
            event.data.message?.trim() === "COPY-ORCHID"
        );
      },
      { intervals: [1000, 2000, 4000], timeout: 30_000 }
    )
    .toBe(true);
  await page.reload();
  await expect(
    page.getByText(
      "What token was in your previous answer? Reply only with the token. Do not call tools.",
      { exact: true }
    )
  ).toBeVisible();
});

for (const attachment of [
  {
    answer: "red",
    bytes: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
      "base64"
    ),
    mediaType: "image/png",
    modelId,
    name: "copy-square.png",
    question:
      "What is the dominant color of the image attached earlier? Reply only with the color. Do not call tools.",
  },
  {
    answer: "cedar-4827",
    bytes: textPdf("Verification code: CEDAR-4827"),
    mediaType: "application/pdf",
    modelId: "google/gemini-2.5-flash",
    name: "copy-code.pdf",
    question:
      "What is the verification code in the document attached earlier? Reply only with the code. Do not call tools.",
  },
]) {
  test(`copied ${attachment.name} survives source deletion, continuation, and imported editing`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(360_000);
    page.setDefaultNavigationTimeout(120_000);
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.request.get("/api/dev-login", {
      maxRedirects: 0,
      timeout: 60_000,
    });
    await page.request.post("/api/chat-model", {
      data: { model: attachment.modelId },
    });
    const { origin } = new URL(z.url().parse(testInfo.project.use.baseURL));
    const upload = await page.request.post("/api/files/upload", {
      multipart: {
        file: {
          buffer: attachment.bytes,
          mimeType: attachment.mediaType,
          name: attachment.name,
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBe(true);
    const file = z.object({ url: z.string() }).parse(await upload.json());
    const created = await page.request.post("/api/agent-conversations", {
      data: {
        message: [
          {
            type: "file",
            data: file.url,
            mediaType: attachment.mediaType,
            filename: attachment.name,
          },
          {
            type: "text",
            text:
              attachment.mediaType === "application/pdf"
                ? "Do not read or transcribe this PDF yet. Save it for my next question. For now respond with only: attachment-ready"
                : "Reply exactly attachment-ready as plain text. Do not describe the attachment or call tools.",
          },
        ],
        modelId: attachment.modelId,
        operationId: crypto.randomUUID(),
      },
      headers: { origin },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const source = conversationBinding.parse(await created.json());
    const [row] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, source.id));
    const native = new Client({
      auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
      headers: { "x-chatjs-owner": row.ownerId },
      host: env.EVE_INTERNAL_ORIGIN ?? "",
    });
    await expect
      .poll(
        async () => {
          const snapshot = await native.sessions
            .attach(source.sessionId)
            .snapshot();
          return (
            snapshot.events.some((event) => event.type === "session.waiting") &&
            snapshot.events.some(
              (event) =>
                event.type === "message.completed" &&
                event.data.message?.trim() === "attachment-ready"
            )
          );
        },
        { intervals: [1000, 2000, 4000], timeout: 45_000 }
      )
      .toBe(true);
    await db
      .update(eveConversation)
      .set({ visibility: "public" })
      .where(eq(eveConversation.id, source.id));
    const copied = await page.request.post("/api/agent-conversation-copies", {
      data: {
        modelId: attachment.modelId,
        operationId: crypto.randomUUID(),
        sourceConversationId: source.id,
      },
      headers: { origin },
    });
    expect(copied.ok(), await copied.text()).toBe(true);
    const destination = conversationBinding.parse(await copied.json());
    const refs = await db
      .select({ key: eveFileReference.key })
      .from(eveFileReference)
      .where(eq(eveFileReference.conversationId, destination.id));
    expect(refs).toHaveLength(1);
    const copiedUrl = `/api/files/content?key=${refs[0].key}`;
    expect(new URL(file.url, origin).searchParams.get("key")).not.toBe(
      refs[0].key
    );
    let saved = await native.sessions.attach(destination.sessionId).snapshot();
    await expect
      .poll(
        async () => {
          if (!saved.events.some((event) => event.type === "history.seeded")) {
            saved = await native.sessions
              .attach(destination.sessionId)
              .snapshot();
          }
          return saved.events.some((event) => event.type === "history.seeded");
        },
        { intervals: [1000, 2000, 4000], timeout: 30_000 }
      )
      .toBe(true);
    expect(
      saved.events.some(
        (event) =>
          event.type === "turn.started" || event.type === "actions.requested"
      )
    ).toBe(false);
    await expect
      .poll(
        async () => {
          const removed = await page.request.delete(
            `/api/agent-conversations/${source.id}`,
            { headers: { origin } }
          );
          expect(removed.ok(), await removed.text()).toBe(true);
          return z.object({ status: z.string() }).parse(await removed.json())
            .status;
        },
        { intervals: [1000, 2000, 4000], timeout: 90_000 }
      )
      .toBe("deleted");
    expect((await page.request.get(file.url)).ok()).toBe(false);
    const retained = await page.request.get(copiedUrl);
    expect(retained.ok()).toBe(true);
    expect(await retained.body()).toEqual(attachment.bytes);
    await page.goto(`/chat/${destination.id}`);
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: attachment.name })
    ).toBeVisible();
    await page
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(attachment.question);
    await page.getByRole("button", { exact: true, name: "Send" }).click();
    await expect
      .poll(
        async () => {
          const continued = await native.sessions
            .attach(destination.sessionId)
            .snapshot();
          return continued.events.some(
            (event) =>
              event.type === "message.completed" &&
              event.data.message?.trim().toLowerCase().replaceAll(".", "") ===
                attachment.answer
          );
        },
        { intervals: [1000, 2000, 4000], timeout: 45_000 }
      )
      .toBe(true);
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { exact: true, name: attachment.name })
    ).toBeVisible();

    await expect(page.getByText("Ready", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { exact: true, name: "Edit message" })
      .first()
      .click();
    const editor = page.getByRole("dialog");
    await expect(
      editor.getByRole("button", { exact: true, name: attachment.name })
    ).toBeVisible();
    if (attachment.mediaType === "image/png") {
      await expect
        .poll(() =>
          editor
            .getByRole("img", { exact: true, name: attachment.name })
            .evaluate(
              (image) =>
                image instanceof HTMLImageElement &&
                image.complete &&
                image.naturalWidth > 0
            )
        )
        .toBe(true);
    }
    await editor
      .getByRole("textbox", { exact: true, name: "Message" })
      .fill(attachment.question);
    await editor.evaluate(async (element) => {
      await document.fonts.ready;
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !==
              Number.POSITIVE_INFINITY
          )
          .map((animation) =>
            animation.finished.catch(() => {
              /* empty */
            })
          )
      );
    });
    await editor.screenshot({
      animations: "allow",
      path: testInfo.outputPath("imported-attachment-edit.png"),
    });
    let edited: z.infer<typeof conversationBinding> | undefined;
    await page.route(
      "**/api/agent-conversations",
      async (route) => {
        const input = createConversationInput.parse(
          route.request().postDataJSON()
        );
        expect(input.fork).toEqual({
          beforeMessageId: "seed_message_0",
          conversationId: destination.id,
        });
        expect(input.modelId).toBe(attachment.modelId);
        if (typeof input.message === "string") {
          throw new TypeError("Edited message lost its attachment");
        }
        const editedFile = input.message.find((part) => part.type === "file");
        if (!editedFile) {
          throw new Error("Edited message lost its attachment");
        }
        expect(editedFile.filename).toBe(attachment.name);
        expect(editedFile.mediaType).toBe(attachment.mediaType);
        expect(new URL(editedFile.data, origin).origin).toBe(origin);
        expect(
          new URL(editedFile.data, origin).searchParams.get("key")
        ).not.toBe(refs[0].key);
        const restored = await page.request.get(editedFile.data);
        expect(restored.status()).toBe(200);
        expect(await restored.body()).toEqual(attachment.bytes);
        const response = await route.fetch({ timeout: 90_000 });
        expect(response.status()).toBe(200);
        edited = conversationBinding.parse(await response.json());
        await route.fulfill({ response });
      },
      { times: 1 }
    );
    await editor.getByRole("button", { exact: true, name: "Send" }).click();
    await expect.poll(() => edited?.id, { timeout: 95_000 }).toBeTruthy();
    await expect(page).toHaveURL(`${origin}/chat/${edited?.id}`, {
      timeout: 120_000,
    });
    const editedAnswer = new RegExp(`^${attachment.answer}\\.?$`, "iu");
    await expect(page.getByRole("log").getByText(editedAnswer)).toBeVisible({
      timeout: 45_000,
    });
    await expect(
      page.getByRole("button", { exact: true, name: "Edit message" })
    ).toHaveCount(1);
    await page.reload();
    await expect(page.getByRole("log").getByText(editedAnswer)).toBeVisible({
      timeout: 30_000,
    });
    const originalCopyFile = await page.request.get(copiedUrl);
    expect(originalCopyFile.status()).toBe(200);
    expect(await originalCopyFile.body()).toEqual(attachment.bytes);
  });
}
