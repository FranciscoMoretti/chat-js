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
import { conversationBinding } from "../lib/eve/contracts";
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
  const origin = new URL(page.url()).origin;
  await page.request.post("/api/chat-model", { data: { model: modelId } });
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId,
      message: "Reply exactly COPY-ORCHID as plain text. Do not call tools.",
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  const [sourceRow] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  const native = new Client({
    host: env.EVE_INTERNAL_ORIGIN ?? "",
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers: { "x-chatjs-owner": sourceRow.ownerId },
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
      { timeout: 30_000, intervals: [1000, 2000, 4000] }
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
        path: testInfo.outputPath("copy-anonymous.png"),
        animations: "disabled",
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
    path: testInfo.outputPath("copy-ready.png"),
    animations: "disabled",
  });
  let rejectedOperation: string | undefined;
  await page.route("**/api/agent-conversation-copies", async (route) => {
    rejectedOperation = eveCopyInput.parse(
      route.request().postDataJSON()
    ).operationId;
    await route.fulfill({
      status: 409,
      json: { error: "This copy is no longer available.", retryable: false },
    });
  });
  await save.getByRole("button", { name: "Save to your chats" }).click();
  await expect(
    save.getByRole("button", { name: "Save another copy" })
  ).toBeEnabled();
  await save.screenshot({
    path: testInfo.outputPath("copy-rejected.png"),
    animations: "disabled",
  });
  await page.unroute("**/api/agent-conversation-copies");
  const copied = Promise.withResolvers<z.infer<typeof conversationBinding>>();
  const held = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  await page.route("**/api/agent-conversation-copies", async (route) => {
    const input = eveCopyInput.parse(route.request().postDataJSON());
    expect(input.modelId).toBe(modelId);
    expect(input.operationId).not.toBe(rejectedOperation);
    started.resolve();
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
      path: testInfo.outputPath("copy-pending.png"),
      animations: "disabled",
    });
  } finally {
    held.resolve();
  }
  const destination = await copied.promise;
  await expect(save.getByRole("alert")).toBeVisible();
  await save.screenshot({
    path: testInfo.outputPath("copy-lost-reply.png"),
    animations: "disabled",
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
      .set({ state: "uncertain", sessionId: null })
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
    path: testInfo.outputPath("copy-recovery.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await recovery.screenshot({
    path: testInfo.outputPath("copy-recovery-mobile.png"),
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1280, height: 720 });
  await recovery.getByRole("button", { name: "Retry saving" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message", exact: true })
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
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "What token was in your previous answer? Reply only with the token. Do not call tools."
    );
  await page.getByRole("group", { name: "Message composer" }).screenshot({
    path: testInfo.outputPath("copy-composer-ready.png"),
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Send", exact: true }).click();
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
      { timeout: 30_000, intervals: [1000, 2000, 4000] }
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
    name: "copy-square.png",
    modelId,
    mediaType: "image/png",
    bytes: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
      "base64"
    ),
    question:
      "What is the dominant color of the image attached earlier? Reply only with the color. Do not call tools.",
    answer: "red",
  },
  {
    name: "copy-code.pdf",
    modelId: "google/gemini-2.5-flash",
    mediaType: "application/pdf",
    bytes: textPdf("Verification code: CEDAR-4827"),
    question:
      "What is the verification code in the document attached earlier? Reply only with the code. Do not call tools.",
    answer: "cedar-4827",
  },
]) {
  test(`copied ${attachment.name} survives source deletion and reaches the first native continuation`, async ({
    page,
  }) => {
    await page.route("https://unpkg.com/react-scan/**", (route) =>
      route.abort()
    );
    await page.goto("/api/dev-login");
    await page.request.post("/api/chat-model", {
      data: { model: attachment.modelId },
    });
    const origin = new URL(page.url()).origin;
    const upload = await page.request.post("/api/files/upload", {
      multipart: {
        file: {
          name: attachment.name,
          mimeType: attachment.mediaType,
          buffer: attachment.bytes,
        },
      },
    });
    expect(upload.ok(), await upload.text()).toBe(true);
    const file = z.object({ url: z.string() }).parse(await upload.json());
    const created = await page.request.post("/api/agent-conversations", {
      headers: { origin },
      data: {
        operationId: crypto.randomUUID(),
        modelId: attachment.modelId,
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
      },
    });
    expect(created.ok(), await created.text()).toBe(true);
    const source = conversationBinding.parse(await created.json());
    const [row] = await db
      .select()
      .from(eveConversation)
      .where(eq(eveConversation.id, source.id));
    const native = new Client({
      host: env.EVE_INTERNAL_ORIGIN ?? "",
      auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
      headers: { "x-chatjs-owner": row.ownerId },
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
        { timeout: 45_000, intervals: [1000, 2000, 4000] }
      )
      .toBe(true);
    await db
      .update(eveConversation)
      .set({ visibility: "public" })
      .where(eq(eveConversation.id, source.id));
    const copied = await page.request.post("/api/agent-conversation-copies", {
      headers: { origin },
      data: {
        operationId: crypto.randomUUID(),
        sourceConversationId: source.id,
        modelId: attachment.modelId,
      },
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
    const saved = await native.sessions
      .attach(destination.sessionId)
      .snapshot();
    expect(saved.events.some((event) => event.type === "history.seeded")).toBe(
      true
    );
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
        { timeout: 45_000, intervals: [1000, 2000, 4000] }
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
        .getByRole("button", { name: attachment.name, exact: true })
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "Message", exact: true })
      .fill(attachment.question);
    await page.getByRole("button", { name: "Send", exact: true }).click();
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
        { timeout: 45_000, intervals: [1000, 2000, 4000] }
      )
      .toBe(true);
    await page.reload();
    await expect(
      page
        .getByRole("log")
        .getByRole("button", { name: attachment.name, exact: true })
    ).toBeVisible();
  });
}
