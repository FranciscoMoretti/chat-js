import { cp, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { z } from "zod";

export const createRuntimeFixture = async (
  fixtureSourceDirectory: string,
  experimentalInstallation?: {
    readonly distribution?: "production-fork";
    readonly nodeModules: string;
    readonly provenance: string;
  }
) => {
  const root = import.meta.dir;
  const nodeModules = path.resolve(
    experimentalInstallation?.nodeModules ?? path.join(root, "node_modules")
  );
  const requestedNode = process.env.EVE_TEST_NODE ?? "node";
  const searchPath = process.env.PATH ?? "";
  const node = Bun.which(requestedNode);
  if (node === null) {
    throw new Error(`Node executable not found: ${requestedNode}`);
  }
  const version = Bun.spawn([node, "--version"], { stdout: "pipe" });
  const versionText = await new Response(version.stdout).text();
  const nodeVersionPattern = /^v(?<major>\d+)\./u;
  const major = Number(nodeVersionPattern.exec(versionText)?.groups?.major);
  const successExitCode = 0;
  const minimumNodeVersion = 24;
  if (
    (await version.exited) !== successExitCode ||
    !Number.isFinite(major) ||
    major < minimumNodeVersion
  ) {
    throw new Error(
      "Node >=24 is required; set EVE_TEST_NODE to its executable."
    );
  }
  const installedPackage: unknown = await Bun.file(
    path.join(nodeModules, "eve/package.json")
  ).json();
  const distribution =
    experimentalInstallation?.distribution === "production-fork"
      ? { name: "@chat-js/eve", version: "0.61.0-chatjs.0" }
      : { name: "eve", version: "0.71.3" };
  z.object({
    name: z.literal(distribution.name),
    version: z.literal(distribution.version),
  }).parse(installedPackage);
  const installedAi: unknown = await Bun.file(
    path.join(nodeModules, "ai/package.json")
  ).json();
  z.object({ name: z.literal("ai"), version: z.literal("7.0.106") }).parse(
    installedAi
  );
  const fixtureSource = path.resolve(root, fixtureSourceDirectory);
  const fixture = await mkdtemp(path.join(tmpdir(), "chatjs-eve-retirement-"));
  await cp(fixtureSource, fixture, { recursive: true });
  await symlink(nodeModules, path.join(fixture, "node_modules"));
  await writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({
      dependencies: {
        ai: "7.0.106",
        eve:
          distribution.name === "eve"
            ? distribution.version
            : `npm:${distribution.name}@${distribution.version}`,
      },
      name: "retirement-fixture",
      private: true,
      type: "module",
    })
  );
  await writeFile(
    path.join(fixture, "runtime-provenance.json"),
    JSON.stringify({
      ai: "7.0.106",
      eve: distribution.version,
      mode: experimentalInstallation ? "experimental" : "published",
      node: versionText.trim(),
      nodeModules,
      provenance:
        experimentalInstallation?.provenance ??
        "eve@0.71.3 / fab8ba1424eddfdedd6a177cac21710258da0e81",
    })
  );
  return {
    cli: path.join(nodeModules, "eve/bin/eve.js"),
    directory: fixture,
    environment: {
      CI: "1",
      DOCKER_HOST: `unix://${fixture}/no-docker.sock`,
      EVE_MOCK_AUTHORED_MODELS: "0",
      HOME: fixture,
      NODE_ENV: "development",
      PATH: `${path.dirname(node)}:${searchPath}`,
      TMPDIR: tmpdir(),
    },
    node,
  };
};
