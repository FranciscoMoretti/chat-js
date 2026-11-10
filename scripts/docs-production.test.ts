import { afterEach, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  checkDeployment,
  docsFingerprint,
  shouldBuildDocs,
} from "./docs-production.mjs";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});
const git = (cwd: string, args: string[]) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
const commit = (cwd: string, file: string, content: string) => {
  mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
  writeFileSync(path.join(cwd, file), content);
  git(cwd, ["add", "."]);
  git(cwd, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.com",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "fixture",
  ]);
  return git(cwd, ["rev-parse", "HEAD"]);
};
const repository = () => {
  const directory = mkdtempSync(path.join(tmpdir(), "docs-production-"));
  directories.push(directory);
  git(directory, ["init"]);
  const previous = commit(directory, "apps/docs/index.mdx", "old docs");
  return { directory, previous };
};

test("app-only commits preserve the docs fingerprint and skip deployment", () => {
  const { directory, previous } = repository();
  commit(directory, "apps/chat/app/page.tsx", "new app");
  expect(docsFingerprint("HEAD", directory)).toBe(
    docsFingerprint(previous, directory)
  );
  expect(shouldBuildDocs(previous, directory)).toBe(false);
});

test.each([
  "apps/docs/index.mdx",
  "apps/docs/public/logo.svg",
  ".agents/skills/example/SKILL.md",
  "bun.lock",
  "package.json",
  "scripts/docs-production.mjs",
])("%s changes require a docs deployment", (file) => {
  const { directory, previous } = repository();
  commit(directory, file, "changed");
  expect(shouldBuildDocs(previous, directory)).toBe(true);
});

test("deleted docs and multi-commit changes are detected", () => {
  const { directory, previous } = repository();
  rmSync(path.join(directory, "apps/docs/index.mdx"));
  commit(directory, "apps/chat/first.ts", "first app change");
  commit(directory, "apps/chat/second.ts", "second app change");
  expect(shouldBuildDocs(previous, directory)).toBe(true);
});

test("missing previous revisions build instead of skipping", () => {
  const { directory } = repository();
  expect(shouldBuildDocs(undefined, directory)).toBe(true);
  expect(shouldBuildDocs("missing-revision", directory)).toBe(true);
});

const homepage = "<html>New docs</html>";
const marker = {
  revision: "commit",
  fingerprint: "current",
  homepageHash: createHash("sha256").update(homepage).digest("hex"),
};
const respond =
  (...responses: Response[]) =>
  async () => {
    const response = responses.shift();
    if (!response) {
      throw new Error("Unexpected request");
    }
    return await Promise.resolve(response);
  };

test("accepts matching docs content even after unrelated source commits", async () => {
  expect(
    await checkDeployment(
      "current",
      respond(Response.json(marker), new Response(homepage))
    )
  ).toBe("commit");
});

test("rejects a successful deployment serving old docs", async () => {
  expect(
    await checkDeployment("new", respond(Response.json(marker))).catch(String)
  ).toContain("different docs revision");
});

test("rejects a stale homepage even when the build marker is current", async () => {
  expect(
    await checkDeployment(
      "current",
      respond(Response.json(marker), new Response("old homepage"))
    ).catch(String)
  ).toContain("homepage does not match");
});

test("rejects a missing build marker", async () => {
  expect(
    await checkDeployment(
      "current",
      respond(new Response("Not found", { status: 404 }))
    ).catch(String)
  ).toContain("HTTP 404");
});
