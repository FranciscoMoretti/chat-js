/* oxlint-disable import/no-nodejs-modules -- The isolated test launcher owns temporary directories and process execution. */
import { cp, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/* oxlint-enable import/no-nodejs-modules */
import { z } from "zod";

/* oxlint-disable max-statements, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- This launcher boundary validates the distribution and assembles the isolated process environment in one ordered setup; infer its concrete return shape. */
export const createRuntimeFixture = async (
  fixtureSourceDirectory: string,
  experimentalInstallation?: {
    readonly nodeModules: string;
    readonly provenance: string;
  }
) => {
  const root = import.meta.dir;
  const nodeModules = path.resolve(
    experimentalInstallation?.nodeModules ?? path.join(root, "node_modules")
  );
  /* oxlint-disable node/no-process-env -- Read only the explicit launcher configuration; no application credentials enter the worker. */
  const requestedNode = process.env.EVE_TEST_NODE ?? "node";
  const searchPath = process.env.PATH ?? "";
  /* oxlint-enable node/no-process-env */
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
  z.object({ name: z.literal("eve"), version: z.literal("0.71.3") }).parse(
    installedPackage
  );
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
    '{"name":"retirement-fixture","type":"module","private":true,"dependencies":{"eve":"0.71.3","ai":"7.0.106"}}\n'
  );
  await writeFile(
    path.join(fixture, "runtime-provenance.json"),
    JSON.stringify({
      ai: "7.0.106",
      eve: "0.71.3",
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
/* oxlint-enable max-statements, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
