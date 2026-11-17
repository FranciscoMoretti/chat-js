/* eslint-disable no-await-in-loop -- Acceptance steps and readiness polling are sequential. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import postgres from "postgres";
import { Sandbox } from "@vercel/sandbox";
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";
import { Client } from "eve/client";
import { chromium } from "playwright";
import { expect as baseExpect } from "playwright/test";
import { z } from "zod";

// Run after CHATJS_NATIVE_SCENARIO=acceptance generation. This harness only
// creates local storage/database resources. Cloud sandbox mode additionally uses
// the explicitly configured Vercel project and removes only run-tagged resources.
const expect = baseExpect.configure({ timeout: 180_000 });
const app = await realpath(process.argv[2] ?? "");
assert.match(app, /^\/(?:private\/)?tmp\/chatjs-native-create-[^/]+\/app$/u);
assert.ok(
  (process.env.AI_GATEWAY_API_KEY ?? "").length > 0,
  "AI_GATEWAY_API_KEY is required"
);
const sandboxProvider = z
  .enum(["just-bash", "vercel"])
  .parse(process.env.CHATJS_NATIVE_SANDBOX ?? "just-bash");
const billingEnabled = await Bun.file(
  path.join(app, "chatjs/plugins/credits/chatjs.json")
).exists();
const cloudCredentials = (() => {
  if (sandboxProvider !== "vercel") {
    return null;
  }
  const token = z.string().min(1).parse(process.env.VERCEL_OIDC_TOKEN);
  const claims = z
    .object({ exp: z.number(), project_id: z.string(), owner_id: z.string() })
    .parse(
      JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString())
    );
  assert.ok(
    claims.exp * 1000 > Date.now() + 600_000,
    "Refresh the development OIDC token before cloud acceptance"
  );
  return { token, projectId: claims.project_id, teamId: claims.owner_id };
})();
const adminUrl = new URL(process.env.CHATJS_NATIVE_POSTGRES_URL ?? "");
assert.ok(["postgres:", "postgresql:"].includes(adminUrl.protocol));
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(adminUrl.hostname));
adminUrl.pathname = "/postgres";
const suffix = randomBytes(8).toString("hex");
const listCloudSandboxes = async () => {
  if (!cloudCredentials) {
    return [];
  }
  const page = await Sandbox.list({
    ...cloudCredentials,
    tags: { acceptance: suffix },
  });
  return await page.toArray();
};
const databaseName = `chatjs_acceptance_${suffix}`;
const containerName = `chatjs-acceptance-${suffix}`;
const databaseUrl = new URL(adminUrl);
databaseUrl.pathname = `/${databaseName}`;
const admin = postgres(adminUrl.href, { max: 1 });
const output = path.join(app, "..", "acceptance");
await mkdir(output, { recursive: true });
const probe = Bun.serve({
  port: 0,
  hostname: "127.0.0.1",
  fetch: () => new Response(),
});
const baseUrl = `http://localhost:${probe.port}`;
await probe.stop(true);
const gatewaySecret = randomBytes(32).toString("hex");
const storageSecret = randomBytes(32).toString("hex");
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  TMPDIR: process.env.TMPDIR,
  NODE_ENV: "development",
  NEXT_TELEMETRY_DISABLED: "1",
  PORT: new URL(baseUrl).port,
  APP_URL: baseUrl,
  EVE_INTERNAL_ORIGIN: baseUrl,
  AUTH_SECRET: randomBytes(32).toString("hex"),
  EVE_GATEWAY_SECRET: gatewaySecret,
  DATABASE_URL: databaseUrl.href,
  DATABASE_MIGRATION_URL: databaseUrl.href,
  WORKFLOW_POSTGRES_URL: databaseUrl.href,
  AUTH_GITHUB_ID: "local-acceptance",
  AUTH_GITHUB_SECRET: "local-acceptance",
  AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  ...(cloudCredentials
    ? {
        VERCEL_OIDC_TOKEN: cloudCredentials.token,
        VERCEL_PROJECT_ID: cloudCredentials.projectId,
        VERCEL_TEAM_ID: cloudCredentials.teamId,
      }
    : {}),
  MINIO_ACCESS_KEY_ID: "chatjs-local",
  MINIO_SECRET_ACCESS_KEY: storageSecret,
};
const run = async (command: string[], logfile: string, environment = env) => {
  const child = Bun.spawn(command, {
    cwd: app,
    env: environment,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  await writeFile(path.join(output, logfile), stdout + stderr, { mode: 0o600 });
  assert.equal(code, 0, `${command[0]} failed; inspect ${logfile}`);
  return stdout.trim();
};
let server: ChildProcess | undefined;
let created = false;
let container = false;
const stop = async () => {
  if (server?.pid !== undefined) {
    for (const signal of ["SIGTERM", "SIGKILL"] as const) {
      try {
        process.kill(-server.pid, signal);
      } catch {
        /* Already stopped. */
      }
      await delay(500);
    }
    server = undefined;
  }
};
let starts = 0;
const start = async () => {
  starts += 1;
  const log = createWriteStream(path.join(output, `server-${starts}.log`), {
    mode: 0o600,
  });
  server = spawn("bun", ["run", "dev"], {
    cwd: app,
    env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.pipe(log, { end: false });
  server.stderr?.pipe(log, { end: false });
  server.once("exit", () => {
    log.end();
  });
  const deadline = Date.now() + 360_000;
  while (Date.now() < deadline) {
    assert.equal(server.exitCode, null, "Generated server exited");
    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return;
      }
    } catch {
      /* Initial compilation. */
    }
    await delay(500);
  }
  throw new Error("Generated app readiness timed out");
};

// Minimal valid PDF, with a unique value that appears only in the uploaded bytes.
const pdf = (token: string) => {
  const stream = `BT /F1 18 Tf 40 100 Td (${token}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let content = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(content));
    content += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(content);
  content += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(content);
};
const browser = await chromium.launch();
const database = postgres(databaseUrl.href, { max: 2 });
try {
  await admin.unsafe(`CREATE DATABASE ${databaseName}`);
  created = true;
  await run(
    [
      "docker",
      "run",
      "-d",
      "--rm",
      "--name",
      containerName,
      "-p",
      "127.0.0.1::9000",
      "-e",
      "MINIO_ROOT_USER=chatjs-local",
      "-e",
      `MINIO_ROOT_PASSWORD=${storageSecret}`,
      "--entrypoint",
      "minio",
      process.env.CHATJS_MINIO_IMAGE ?? "quay.io/minio/minio:latest",
      "server",
      "/data",
      "--address",
      ":9000",
    ],
    "storage-start.log"
  );
  container = true;
  const port = await run(
    ["docker", "port", containerName, "9000"],
    "storage-port.log"
  );
  const storageEndpoint = `http://${port}`;
  await expect
    .poll(async () => {
      try {
        const response = await fetch(`${storageEndpoint}/minio/health/live`);
        return response.ok;
      } catch {
        return false;
      }
    })
    .toBe(true);
  const s3 = new S3Client({
    endpoint: storageEndpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: "chatjs-local",
      secretAccessKey: storageSecret,
    },
  });
  await s3.send(new CreateBucketCommand({ Bucket: "chatjs-acceptance" }));
  s3.destroy();
  const optionsPath = path.join(app, "chatjs/providers/storage-options.ts");
  const originalOptions = await readFile(optionsPath, "utf-8");
  await writeFile(
    optionsPath,
    originalOptions.replace(/http:\/\/127\.0\.0\.1:\d+/u, storageEndpoint)
  );
  // Both providers are native EVE selections, isolated to this disposable fixture.
  await writeFile(
    path.join(app, "agent/sandbox.ts"),
    sandboxProvider === "vercel"
      ? `import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";
export const environment = VercelSandbox.environment({tags: {acceptance: "${suffix}"}, resources: {vcpus: 1}, timeout: 300000});
export default defineSandbox(() => environment.open());
`
      : 'import { defineSandbox } from "eve/sandbox";\nimport { JustBashSandbox } from "eve/sandbox/just-bash";\nexport const environment = JustBashSandbox.environment();\nexport default defineSandbox(() => environment.open());\n'
  );
  if (sandboxProvider === "just-bash") {
    await run(["bun", "add", "just-bash"], "sandbox-install.log");
  }
  await run(["bun", "run", "setup"], "setup.log");
  await start();
  console.log(`Acceptance app ready: ${baseUrl}`);
  const context = await browser.newContext({ baseURL: baseUrl });
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);
  await page.goto(`${baseUrl}/api/dev-login`);
  if (billingEnabled) {
    // This is fixture credit, entirely inside the disposable local database.
    await database`insert into "UserCredit" ("userId", credits) select id, 100 from "user" on conflict ("userId") do update set credits=100`;
  }
  const composer = page.getByTestId("multimodal-input");
  await expect(composer).toBeVisible();
  await composer.fill(
    "Use web_fetch to retrieve https://example.com and tell me its title. Do not use any other tool."
  );
  const creation = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/agent-conversations" &&
      response.request().method() === "POST"
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const createdResponse = await creation;
  assert.ok(createdResponse.ok());
  const { id: conversationId } = z
    .object({ id: z.string() })
    .parse(await createdResponse.json());
  await expect(page).toHaveURL(/\/chat\//u);
  await expect
    .poll(async () => {
      const rows =
        await database`select "sessionId" from "EveConversation" where id=${conversationId ?? ""}`;
      return z
        .object({ sessionId: z.string().nullable() })
        .optional()
        .parse(rows.at(0))?.sessionId;
    })
    .toBeTruthy();
  const rows =
    await database`select "ownerId", "sessionId" from "EveConversation" where id=${conversationId ?? ""}`;
  const row = z
    .object({ ownerId: z.string(), sessionId: z.string() })
    .parse(rows.at(0));
  const client = new Client({
    baseUrl: `${baseUrl}/eve/chat`,
    auth: { bearer: gatewaySecret },
    headers: { "x-chatjs-owner": row.ownerId },
  });
  const session = client.sessions.attach(row.sessionId);
  let eventOffset = 0;
  const completeTurn = async (toolName: string, approve = true) => {
    const answered = new Set<string>();
    await expect
      .poll(async () => {
        const snapshot = await session.snapshot({
          signal: AbortSignal.timeout(30_000),
        });
        const events = snapshot.events.slice(eventOffset);
        if (events.some((event) => event.type === "turn.settled")) {
          return true;
        }
        const settled = new Set(
          events.flatMap((event) =>
            event.type === "interaction.settled"
              ? [event.data.interactionId]
              : []
          )
        );
        for (const event of events) {
          if (
            event.type !== "interaction.opened" ||
            settled.has(event.data.interactionId) ||
            answered.has(event.data.interactionId)
          ) {
            continue;
          }
          const subject = z
            .object({ callId: z.string() })
            .parse(event.data.subject);
          const request = events.find(
            (candidate) =>
              candidate.type === "call.requested" &&
              candidate.data.callId === subject.callId
          );
          assert.ok(request?.type === "call.requested");
          const { name } = request.data.capability;
          // EVE may read a destination before writing it. Permit that native preflight,
          // but never silently approve a different capability selected by the model.
          assert.ok(
            name === toolName ||
              (toolName === "write_file" && name === "read_file"),
            `Unexpected approval: ${name}`
          );
          const accepted = name === toolName ? approve : true;
          const button = page
            .getByRole("button", {
              name: accepted
                ? /^(?:approve|allow once)$/iu
                : /^(?:deny|reject)$/iu,
            })
            .first();
          await expect(button).toBeVisible();
          await page.screenshot({
            path: path.join(
              output,
              `${toolName}-${accepted ? "approve" : "deny"}-${answered.size}.png`
            ),
          });
          await button.click();
          answered.add(event.data.interactionId);
        }
        return false;
      })
      .toBe(true);
    await expect(
      page.getByRole("button", { name: "Stop", exact: true })
    ).toHaveCount(0);
    const snapshot = await session.snapshot({
      signal: AbortSignal.timeout(30_000),
    });
    const events = snapshot.events.slice(eventOffset);
    eventOffset = snapshot.events.length;
    await writeFile(
      path.join(output, `${toolName}-${approve ? "approved" : "denied"}.json`),
      JSON.stringify(events, null, 2)
    );
    const terminal = events.find((event) => event.type === "turn.settled");
    assert.ok(terminal?.type === "turn.settled");
    assert.equal(
      terminal.data.outcome,
      "completed",
      "Native turn failed after tool execution"
    );
    const request = events.find(
      (event) =>
        event.type === "call.requested" &&
        event.data.capability.name === toolName
    );
    assert.ok(
      request?.type === "call.requested",
      `Missing native ${toolName} request`
    );
    const settled = events.find(
      (event) =>
        event.type === "call.settled" &&
        event.data.callId === request.data.callId
    );
    assert.ok(
      settled?.type === "call.settled",
      `Missing native ${toolName} settlement`
    );
    assert.equal(settled.data.outcome, approve ? "completed" : "rejected");
    console.log(
      `Native ${toolName}: ${approve ? "approved and executed" : "denied"}`
    );
    return settled;
  };
  const fetched = await completeTurn("web_fetch");
  assert.match(JSON.stringify(fetched.data.output), /Example Domain/u);
  const token = `CHATJS-${randomBytes(6).toString("hex")}`;
  const original = pdf(token);
  const uploaded = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/files/upload" &&
      response.request().method() === "POST"
  );
  await page
    .locator('input[type="file"][aria-label="Attach files"]')
    .setInputFiles({
      name: "acceptance.pdf",
      mimeType: "application/pdf",
      buffer: original,
    });
  const uploadResponse = await uploaded;
  assert.ok(
    uploadResponse.ok(),
    `Upload failed: ${await uploadResponse.text()}`
  );
  const file = z.object({ url: z.string() }).parse(await uploadResponse.json());
  await composer.fill(
    "Read the token printed in the attached PDF. Use write_file to save ONLY that token into /workspace/acceptance.txt. Reply saved. Use no other tool."
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await completeTurn("write_file");
  const stored = await context.request.get(file.url);
  assert.ok(stored.ok());
  assert.deepEqual(await stored.body(), original);
  const anonymous = await browser.newContext();
  const anonymousDownload = await anonymous.request.get(
    new URL(file.url, baseUrl).href
  );
  assert.equal(anonymousDownload.status(), 404);
  await anonymous.close();
  const cloudSandboxes = await listCloudSandboxes();
  if (cloudCredentials) {
    assert.equal(
      cloudSandboxes.length,
      1,
      "Expected one native session sandbox"
    );
    const sandbox = await Sandbox.get({
      ...cloudCredentials,
      name: cloudSandboxes[0].name,
      resume: false,
    });
    await sandbox.stop();
    console.log("Native Vercel sandbox stopped for persistence verification");
  }
  const conversationUrl = page.url();
  await page.goto("about:blank");
  await stop();
  await start();
  await page.goto(conversationUrl);
  await expect(composer).toBeVisible();
  await composer.fill(
    "Use read_file to read /workspace/acceptance.txt and reply with its contents. Use no other tool."
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  const resumed = await completeTurn("read_file");
  assert.ok(
    JSON.stringify(resumed.data.output).includes(token),
    "Native sandbox file did not survive restart"
  );
  if (cloudCredentials) {
    const resumedCloud = await listCloudSandboxes();
    assert.deepEqual(
      resumedCloud.map((value) => value.name),
      cloudSandboxes.map((value) => value.name)
    );
    assert.equal(resumedCloud[0]?.status, "running");
  }
  await composer.fill(
    "Use write_file to create /workspace/denied.txt containing denied. If permission is denied, do not retry and do not use another tool."
  );
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await completeTurn("write_file", false);
  await page.screenshot({
    path: path.join(output, "resumed.png"),
    fullPage: true,
  });
  const ledger =
    await database`select "eventId", "costUsd", "chargedCents" from "EveUsage"`;
  const entries = z
    .array(
      z.object({
        eventId: z.string(),
        costUsd: z.string().nullable(),
        chargedCents: z.number(),
      })
    )
    .parse(ledger);
  await writeFile(
    path.join(output, "billing.json"),
    JSON.stringify(entries, null, 2)
  );
  const chargedCents = entries.reduce(
    (total, entry) => total + entry.chargedCents,
    0
  );
  if (billingEnabled) {
    assert.ok(entries.length > 0, "Model billing must still produce receipts");
    assert.ok(
      entries.every((entry) => entry.costUsd !== null),
      "Unresolved model billing"
    );
    assert.ok(
      entries.every((entry) => !entry.eventId.startsWith("eve-tool:")),
      "Unmetered native calls must not create tool charges"
    );
    // A provider can report a genuine zero cost (for example with BYOK).
    const expectedCharges =
      await database`select coalesce(sum(cents),0)::int as cents from (select ceil(sum("costUsd")*100) as cents from "EveUsage" group by "sessionId","turnId") totals`;
    assert.equal(
      chargedCents,
      z.object({ cents: z.number() }).parse(expectedCharges.at(0)).cents
    );
    const balances =
      await database`select credits from "UserCredit" where "userId"=${row.ownerId}`;
    assert.equal(
      z.object({ credits: z.number() }).parse(balances.at(0)).credits,
      100 - chargedCents
    );
  } else {
    assert.equal(
      entries.length,
      0,
      "A billing-free app must not require usage receipts"
    );
  }
  const beforeEnd = await session.snapshot({
    signal: AbortSignal.timeout(30_000),
  });
  await writeFile(
    path.join(output, "before-end.json"),
    JSON.stringify(beforeEnd, null, 2)
  );
  const deletion = await context.request.delete(
    `${baseUrl}/api/agent-conversations/${conversationId}`,
    { headers: { origin: baseUrl }, timeout: 180_000 }
  );
  assert.equal(
    deletion.status(),
    200,
    `Deletion failed: ${await deletion.text()}`
  );
  if (cloudCredentials) {
    const remaining = await listCloudSandboxes();
    assert.equal(
      remaining.length,
      0,
      "EVE must delete its native sandbox on session end"
    );
  }
  if (billingEnabled) {
    const balances =
      await database`select credits from "UserCredit" where "userId"=${row.ownerId}`;
    assert.equal(
      z.object({ credits: z.number() }).parse(balances.at(0)).credits,
      100 - chargedCents,
      "Retirement replay must not debit usage twice"
    );
  }
  const deletedDownload = await context.request.get(
    new URL(file.url, baseUrl).href
  );
  assert.equal(deletedDownload.status(), 404);
  const final =
    await database`select state from "EveConversation" where id=${conversationId ?? ""}`;
  assert.equal(final.at(0)?.state, "deleted");
  await writeFile(
    path.join(output, "report.json"),
    JSON.stringify(
      {
        officialTool: "web_fetch",
        approval: true,
        denial: true,
        upload: true,
        privateOriginal: true,
        restartedSession: true,
        nativeSandboxFile: true,
        deletion: true,
        billingOptional: true,
        billingEnabled,
        chargedCents,
        modelCostUsd: entries.reduce(
          (total, entry) => total + Number(entry.costUsd),
          0
        ),
        sandboxProvider,
        cloudStopResume: cloudCredentials !== null,
        nativeCloudCleanup: cloudCredentials !== null,
        model: "openai/gpt-5-mini",
      },
      null,
      2
    )
  );
  console.log(`Native acceptance passed: ${output}`);
} catch (error) {
  for (const [index, page] of browser
    .contexts()
    .flatMap((context) => context.pages())
    .entries()) {
    await writeFile(
      path.join(output, `failure-${index}.txt`),
      (await page
        .locator("body")
        .textContent()
        .catch(() => "Page unavailable")) ?? ""
    );
    await page
      .screenshot({ path: path.join(output, `failure-${index}.png`) })
      .catch(() => {
        /* The page may already be closed. */
      });
  }
  throw error;
} finally {
  await browser.close();
  await stop();
  try {
    if (cloudCredentials) {
      const remaining = await listCloudSandboxes();
      for (const resource of remaining) {
        const sandbox = await Sandbox.get({
          ...cloudCredentials,
          name: resource.name,
          resume: false,
        });
        await sandbox.delete({ deleteOrphanSnapshots: true });
      }
    }
  } finally {
    await database.end();
    if (created) {
      await admin.unsafe(`DROP DATABASE ${databaseName} WITH (FORCE)`);
    }
    await admin.end();
    if (container) {
      await run(["docker", "rm", "-f", containerName], "storage-stop.log");
    }
  }
}
