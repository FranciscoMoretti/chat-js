import { readFile, writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { Client } from "eve/client";
import { z } from "zod";
import { db } from "../lib/db/client";
import {
  eveConversation,
  evePersistentSandbox,
  eveSandboxSession,
  eveWorkspaceAttachment,
} from "../lib/db/schema";
import { conversationBinding } from "../lib/eve/contracts";
import { getEveConnectionOptions } from "../lib/eve/connection-options";
import { EVE_MESSAGE_OPERATION_HEADER } from "../lib/eve/message-delivery";
import { sharedEveMessages } from "../lib/eve/shared-messages";
import { getPersistentSandboxProvider } from "../lib/sandbox/runtime";
import { textPdf } from "./eve-attachment-fixtures";
import { assertEveTestDatabase } from "./eve-test-database";

assertEveTestDatabase(process.env.DATABASE_URL ?? "http://invalid");
const modelId = "google/gemini-2.5-flash-lite";
const redPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAb0lEQVR4nO3PAQkAAAyEwO9feoshgnABdLep8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3I8QUNyPEFDcjxBQ3IPanc8OLDQitxAAAAAElFTkSuQmCC",
  "base64"
);

test("shared workspace forks retain immutable image/PDF originals and independent bounded history", async ({
  page,
  browser,
}, testInfo) => {
  test.setTimeout(360_000);
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  await page.request.post("/api/chat-model", { data: { model: modelId } });
  const uploads = await Promise.all([
    page.request.post("/api/files/upload", {
      multipart: {
        file: { buffer: redPng, mimeType: "image/png", name: "shared-red.png" },
      },
    }),
    page.request.post("/api/files/upload", {
      multipart: {
        file: {
          buffer: textPdf("Verification code: CEDAR-4827"),
          mimeType: "application/pdf",
          name: "shared-code.pdf",
        },
      },
    }),
  ]);
  const files = await Promise.all(
    uploads.map(async (response) => {
      expect(response.ok(), await response.text()).toBe(true);
      return z.object({ url: z.string() }).parse(await response.json());
    })
  );
  const image = files.at(0);
  const pdf = files.at(1);
  if (!image || !pdf) {
    throw new Error("Upload missing");
  }
  const created = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId,
      message: [
        {
          type: "text",
          text: "What is the image's dominant color and the PDF verification code? Reply with only the color and code. Do not call tools.",
        },
        {
          type: "file",
          data: image.url,
          mediaType: "image/png",
          filename: "shared-red.png",
        },
        {
          type: "file",
          data: pdf.url,
          mediaType: "application/pdf",
          filename: "shared-code.pdf",
        },
      ],
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const source = conversationBinding.parse(await created.json());
  const [sourceRow] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, source.id));
  if (sourceRow === undefined) {
    throw new Error("Missing source");
  }
  await testInfo.attach("source-workspace", {
    body: JSON.stringify({ source, workspaceId: sourceRow.workspaceId }),
    contentType: "application/json",
  });
  const native = new Client(getEveConnectionOptions(sourceRow.ownerId));
  const messages = async (sessionId: string) => {
    const snapshot = await native.sessions.attach(sessionId).snapshot();
    return sharedEveMessages(snapshot.events);
  };
  await page.goto(`/chat/${source.id}`);
  await expect(page.locator(".is-assistant")).toContainText("CEDAR-4827", {
    timeout: 120_000,
  });
  await expect(page.locator(".is-assistant")).toContainText(/red/iu);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible();
  const sourceHistory = await messages(source.sessionId);
  const firstUser = sourceHistory.find((message) => message.role === "user");
  if (!firstUser) {
    throw new Error("Missing boundary");
  }
  const originals = await db
    .select()
    .from(eveWorkspaceAttachment)
    .where(eq(eveWorkspaceAttachment.workspaceId, sourceRow.workspaceId));
  expect(originals).toHaveLength(2);
  expect(originals.every((file) => file.paths.length > 0)).toBe(true);
  const copied = await page.request.post("/api/agent-conversation-copies", {
    headers: { origin },
    data: {
      sourceConversationId: source.id,
      operationId: crypto.randomUUID(),
      modelId,
    },
  });
  expect(copied.ok(), await copied.text()).toBe(true);
  const fork = conversationBinding.parse(await copied.json());
  const [forkRow] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, fork.id));
  expect(forkRow?.workspaceId).toBe(sourceRow.workspaceId);
  expect(fork.sessionId).not.toBe(source.sessionId);
  await expect
    .poll(
      async () => {
        const history = await messages(fork.sessionId);
        return history.length;
      },
      {
        timeout: 30_000,
      }
    )
    .toBe(sourceHistory.length);
  expect(
    await db
      .select()
      .from(eveWorkspaceAttachment)
      .where(eq(eveWorkspaceAttachment.workspaceId, sourceRow.workspaceId))
  ).toEqual(originals);
  const resources = await db
    .select()
    .from(evePersistentSandbox)
    .where(eq(evePersistentSandbox.workspaceId, sourceRow.workspaceId));
  expect(resources).toHaveLength(1);
  const resource = resources.at(0);
  if (!resource) {
    throw new Error("Missing workspace sandbox");
  }
  const provider = getPersistentSandboxProvider().persistent;
  const sourceSandbox = await provider.open(resource.name);
  await sourceSandbox.writeTextFile({
    path: "/workspace/shared-live.txt",
    content: "written by original",
  });
  const forkSandbox = await provider.open(resource.name);
  expect(
    await forkSandbox.readTextFile({ path: "/workspace/shared-live.txt" })
  ).toBe("written by original");
  await forkSandbox.writeTextFile({
    path: "/workspace/shared-live.txt",
    content: "written by fork",
  });
  expect(
    await sourceSandbox.readTextFile({ path: "/workspace/shared-live.txt" })
  ).toBe("written by fork");
  const [originalImage, originalPdf] = originals;
  if (!originalImage?.paths[0] || !originalPdf?.paths[0]) {
    throw new Error("Missing original paths");
  }
  await sourceSandbox.writeTextFile({
    path: originalImage.paths[0],
    content: "physical working copy changed",
  });
  await sourceSandbox.removePath({ path: originalPdf.paths[0], force: true });
  await page.goto(`/chat/${fork.id}`);
  const composer = page.getByRole("group", {
    name: "Message composer",
    exact: true,
  });
  await composer
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "Read the original attached image and PDF again. Return the dominant color and verification code only, without tools."
    );
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".is-assistant")).toHaveCount(2, {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator(".is-assistant").last()).toContainText(
    "CEDAR-4827"
  );
  await expect(page.locator(".is-assistant").last()).toContainText(/red/iu);
  expect(
    await sourceSandbox.readTextFile({ path: originalImage.paths[0] })
  ).toBe("physical working copy changed");
  expect(
    await sourceSandbox.readBinaryFile({ path: originalPdf.paths[0] })
  ).toBeNull();
  expect(await messages(source.sessionId)).toHaveLength(sourceHistory.length);
  const beforeResponse = await page.request.post("/api/agent-conversations", {
    headers: { origin },
    data: {
      operationId: crypto.randomUUID(),
      modelId,
      message: "Reply exactly BEFORE. Do not call tools.",
      fork: { conversationId: source.id, beforeMessageId: firstUser.id },
      forkKind: "edit",
    },
  });
  expect(beforeResponse.ok(), await beforeResponse.text()).toBe(true);
  const before = conversationBinding.parse(await beforeResponse.json());
  await page.goto(`/chat/${before.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  const beforeHistory = await messages(before.sessionId);
  expect(
    beforeHistory
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "file")
  ).toHaveLength(0);
  const [beforeRow] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, before.id));
  expect(beforeRow?.workspaceId).toBe(sourceRow.workspaceId);
  const anonymous = await browser.newContext();
  try {
    const denied = await anonymous.request.post(
      `${origin}/api/agent-conversation-copies`,
      {
        headers: { origin },
        data: {
          sourceConversationId: source.id,
          operationId: crypto.randomUUID(),
          modelId,
        },
      }
    );
    expect(denied.status()).toBe(401);
  } finally {
    await anonymous.close();
  }
  const foreign = new Client(getEveConnectionOptions(crypto.randomUUID()));
  await expect(
    foreign.sessions.attach(fork.sessionId).snapshot()
  ).rejects.toThrow();
  const deleted = await page.request.delete(
    `/api/agent-conversations/${source.id}`,
    { headers: { origin } }
  );
  expect(deleted.ok(), await deleted.text()).toBe(true);
  await page.goto(`/chat/${fork.id}`);
  await page.reload();
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await composer
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "Read the original attachments once more. Return the image color and PDF code. Do not call tools."
    );
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".is-assistant")).toHaveCount(3, {
    timeout: 90_000,
  });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator(".is-assistant").last()).toContainText(
    "CEDAR-4827"
  );
  expect(
    await provider
      .open(resource.name)
      .then(
        async (sandbox) =>
          await sandbox.readTextFile({ path: "/workspace/shared-live.txt" })
      )
  ).toBe("written by fork");
  if (
    process.env.CHATJS_WORKSPACE_RESTART_FIXTURE !== undefined &&
    process.env.CHATJS_WORKSPACE_RESTART_FIXTURE !== ""
  ) {
    await writeFile(
      process.env.CHATJS_WORKSPACE_RESTART_FIXTURE,
      JSON.stringify({
        source,
        fork,
        before,
        ownerId: sourceRow.ownerId,
        workspaceId: sourceRow.workspaceId,
        sandboxName: resource.name,
      })
    );
  }
  await testInfo.attach("workspace-bindings", {
    body: JSON.stringify({
      source,
      fork,
      before,
      workspaceId: sourceRow.workspaceId,
      sandboxName: resource.name,
    }),
    contentType: "application/json",
  });
  const sessions = await db
    .select()
    .from(eveSandboxSession)
    .where(eq(eveSandboxSession.workspaceId, sourceRow.workspaceId));
  expect(
    sessions.filter((session) => session.state === "active").length
  ).toBeGreaterThanOrEqual(2);
  expect(
    await db
      .select()
      .from(evePersistentSandbox)
      .where(eq(evePersistentSandbox.workspaceId, sourceRow.workspaceId))
  ).toHaveLength(1);
});

// Run the first flow with CHATJS_WORKSPACE_RESTART_FIXTURE pointing outside the
// repository, stop/restart the supervisor, then run only this continuation test.
test("existing shared workspace survives supervisor restart and rejects overlapping sibling turns", async ({
  page,
}) => {
  const fixturePath = process.env.CHATJS_WORKSPACE_RESTART_FIXTURE;
  test.skip(
    fixturePath === undefined || fixturePath === "",
    "Requires the preceding flow and a real supervisor restart"
  );
  if (fixturePath === undefined || fixturePath === "") {
    return;
  }
  test.setTimeout(180_000);
  const binding = z.object({ id: z.uuid(), sessionId: z.string().min(1) });
  const fixture = z
    .object({
      workspaceId: z.uuid(),
      ownerId: z.uuid(),
      sandboxName: z.string().min(1),
      source: binding,
      fork: binding,
      before: binding,
    })
    .parse(JSON.parse(await readFile(fixturePath, "utf-8")));
  await page.route("https://unpkg.com/react-scan/**", async (route) => {
    await route.abort();
  });
  await page.goto("/api/dev-login");
  const { origin } = new URL(page.url());
  const [source] = await db
    .select()
    .from(eveConversation)
    .where(eq(eveConversation.id, fixture.source.id));
  expect(source?.state).toBe("deleted");
  const originals = await db
    .select()
    .from(eveWorkspaceAttachment)
    .where(eq(eveWorkspaceAttachment.workspaceId, fixture.workspaceId));
  expect(originals).toHaveLength(2);
  const native = new Client(getEveConnectionOptions(fixture.ownerId));
  const completedCount = async (sessionId: string) => {
    const snapshot = await native.sessions.attach(sessionId).snapshot();
    return snapshot.events.filter((event) => event.type === "turn.completed")
      .length;
  };
  await page.goto(`/chat/${fixture.fork.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const assistants = page.locator(".is-assistant");
  const previousCount = await assistants.count();
  const composer = page.getByRole("group", {
    name: "Message composer",
    exact: true,
  });
  await composer
    .getByRole("textbox", { name: "Message", exact: true })
    .fill(
      "Read the original image and PDF after restart. Return the image color and PDF code only. Do not call tools."
    );
  await composer.getByRole("button", { name: "Send", exact: true }).click();
  await expect(assistants).toHaveCount(previousCount + 1, { timeout: 90_000 });
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(assistants.last()).toContainText("CEDAR-4827");
  await expect(assistants.last()).toContainText(/red/iu);
  const sandbox = await getPersistentSandboxProvider().persistent.open(
    fixture.sandboxName
  );
  expect(
    await sandbox.readTextFile({ path: "/workspace/shared-live.txt" })
  ).toBe("written by fork");
  const siblings = [fixture.fork, fixture.before];
  const previousCompleted = await Promise.all(
    siblings.map(async (sibling) => await completedCount(sibling.sessionId))
  );
  const responses = await Promise.all(
    siblings.map(
      async (sibling) =>
        await page.request.post(`/api/eve/v1/session/${sibling.sessionId}`, {
          headers: {
            origin,
            [EVE_MESSAGE_OPERATION_HEADER]: crypto.randomUUID(),
          },
          data: {
            modelId,
            message:
              "Write exactly 20 numbered short lines about forests. Do not use tools.",
          },
        })
    )
  );
  expect(
    responses
      .map((response) => response.status())
      .toSorted((left, right) => left - right)
  ).toEqual([200, 409]);
  await Promise.all(
    responses.map(async (response, index) => {
      const sibling = siblings.at(index);
      const count = previousCompleted.at(index);
      if (sibling === undefined || count === undefined) {
        throw new Error("Missing sibling result");
      }
      if (response.ok()) {
        await expect
          .poll(async () => await completedCount(sibling.sessionId), {
            timeout: 90_000,
          })
          .toBe(count + 1);
      } else {
        expect(await response.json()).toMatchObject({
          code: "chatjs_command_rejected",
        });
        expect(await completedCount(sibling.sessionId)).toBe(count);
      }
    })
  );
  const acceptedSibling = siblings.at(
    responses.findIndex((response) => response.ok())
  );
  if (acceptedSibling === undefined) {
    throw new Error("Missing accepted sibling");
  }
  await page.goto(`/chat/${acceptedSibling.id}`);
  await expect(page.getByText("Ready", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const resources = await db
    .select()
    .from(evePersistentSandbox)
    .where(eq(evePersistentSandbox.workspaceId, fixture.workspaceId));
  expect(resources).toHaveLength(1);
  expect(resources.at(0)?.name).toBe(fixture.sandboxName);
  expect(
    await db
      .select()
      .from(eveWorkspaceAttachment)
      .where(eq(eveWorkspaceAttachment.workspaceId, fixture.workspaceId))
  ).toEqual(originals);
});
