import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const docsInputs = [
  "apps/docs",
  ".agents/skills",
  "bun.lock",
  "package.json",
  "scripts/docs-production.mjs",
];
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
/** @param {string | Buffer} value Content to fingerprint. */
const digest = (value) => createHash("sha256").update(value).digest("hex");
/** @param {string[]} args Git arguments, without shell interpolation. */
const git = (args, cwd = repoRoot) =>
  execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

export const docsFingerprint = (revision = "HEAD", cwd = repoRoot) =>
  digest(git(["ls-tree", "-r", revision, "--", ...docsInputs], cwd));

/** @param {string | undefined} previousRevision Last successful deployment revision. */
export const shouldBuildDocs = (previousRevision, cwd = repoRoot) => {
  if (previousRevision === undefined || previousRevision === "") {
    return true;
  }
  try {
    return (
      docsFingerprint(previousRevision, cwd) !== docsFingerprint("HEAD", cwd)
    );
  } catch {
    // Missing shallow history must build rather than silently skip changed docs.
    return true;
  }
};

export const writeDeploymentMarker = async (
  directory = path.join(repoRoot, "apps/docs/dist")
) => {
  const homepage = await readFile(path.join(directory, "index.html"));
  const marker = {
    revision: git(["rev-parse", "HEAD"]),
    fingerprint: docsFingerprint(),
    homepageHash: digest(homepage),
  };
  await writeFile(
    path.join(directory, "deployment.json"),
    `${JSON.stringify(marker)}\n`
  );
};

/**
 * @param {string} expectedFingerprint Expected docs source fingerprint.
 * @param {(url: string, options: RequestInit) => Promise<Response>} fetchPage HTTP transport.
 */
export const checkDeployment = async (
  expectedFingerprint,
  fetchPage = async (url, options) => await fetch(url, options)
) => {
  const base = "https://www.chatjs.dev/docs";
  const query = `?verification=${expectedFingerprint}`;
  /** @type {RequestInit} */
  const options = { cache: "no-store", signal: AbortSignal.timeout(15_000) };
  const response = await fetchPage(`${base}/deployment.json${query}`, options);
  if (!response.ok) {
    throw new Error(`Docs build marker returned HTTP ${response.status}`);
  }
  /** @type {unknown} */
  const marker = await response.json();
  if (
    typeof marker !== "object" ||
    marker === null ||
    !("fingerprint" in marker) ||
    typeof marker.fingerprint !== "string" ||
    !("revision" in marker) ||
    typeof marker.revision !== "string" ||
    !("homepageHash" in marker) ||
    typeof marker.homepageHash !== "string"
  ) {
    throw new Error("Invalid docs build marker");
  }
  if (marker.fingerprint !== expectedFingerprint) {
    throw new Error("Production is serving a different docs revision");
  }
  const homepage = await fetchPage(`${base}${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!homepage.ok) {
    throw new Error(`Docs homepage returned HTTP ${homepage.status}`);
  }
  if (
    digest(Buffer.from(await homepage.arrayBuffer())) !== marker.homepageHash
  ) {
    throw new Error("Production homepage does not match its docs build marker");
  }
  return marker.revision;
};

const verifyProduction = async () => {
  const expected = docsFingerprint();
  const deadline = Date.now() + 15 * 60_000;
  let failure = "Production docs have not been verified";
  while (Date.now() < deadline) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Poll until Vercel assigns the production deployment.
      const revision = await checkDeployment(expected);
      console.log(`Production docs verified at ${revision}`);
      return;
    } catch (error) {
      failure =
        error instanceof Error ? error.message : "Production request failed";
      console.log(`Waiting for production docs: ${failure}`);
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Keep requests bounded while the deployment is building.
    await sleep(15_000);
  }
  throw new Error(
    `${failure}. Check the chat-js-docs production branch and deployment in Vercel.`
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  const command = process.argv.at(2) ?? "";
  switch (command) {
    case "ignore": {
      process.exitCode = shouldBuildDocs(process.env.VERCEL_GIT_PREVIOUS_SHA)
        ? 1
        : 0;
      break;
    }
    case "stamp": {
      await writeDeploymentMarker();
      break;
    }
    case "verify": {
      await verifyProduction();
      break;
    }
    default: {
      throw new Error("Expected ignore, stamp, or verify");
    }
  }
}
