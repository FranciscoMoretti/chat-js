import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { assertPrereleasesPublished, publicPrereleases } from "./release-guard";

const beta = {
  name: "@chat-js/cli",
  version: "0.9.0-beta.1",
  directory: "/unused",
};

const rejectionMessage = async (
  action: () => Promise<void>
): Promise<string> => {
  try {
    await action();
    return "unexpected success";
  } catch (error) {
    if (error instanceof Error) {
      return error.message;
    }
    throw error;
  }
};

test("ordinary releases skip audited published betas without publishing or changing stable tags", async () => {
  let lookups = 0;
  const lookup = async () => {
    lookups += 1;
    return await Promise.resolve({
      version: beta.version,
      "dist-tags": { latest: "0.8.0", beta: beta.version },
    });
  };
  await assertPrereleasesPublished([beta], lookup);
  await assertPrereleasesPublished([], lookup);
  expect(lookups).toBe(1);
});

for (const result of [
  { error: { code: "E404" } },
  { version: "0.9.0-beta.0", "dist-tags": { latest: "0.8.0" } },
  { version: beta.version, "dist-tags": { latest: beta.version } },
  { version: beta.version, "dist-tags": {} },
]) {
  test(`refuses unsafe registry state: ${JSON.stringify(result)}`, async () => {
    const message = await rejectionMessage(async () => {
      await assertPrereleasesPublished(
        [beta],
        async () => await Promise.resolve(result)
      );
    });
    expect(message).toContain(
      "Publish the audited beta explicitly first with --tag beta"
    );
  });
}

test("registry/authentication failures fail closed", async () => {
  const message = await rejectionMessage(async () => {
    await assertPrereleasesPublished(
      [beta],
      async () => await Promise.reject(new Error("E401/network failure"))
    );
  });
  expect(message).toContain("Registry lookup failures also block publication");
});

test("discovers public workspace prereleases and retains their configured registry", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-release-guard-"));
  try {
    await Bun.write(
      path.join(root, "package.json"),
      JSON.stringify({ workspaces: ["packages/*", "apps/*"] })
    );
    await Bun.write(
      path.join(root, "packages/cli/package.json"),
      JSON.stringify({
        name: beta.name,
        version: beta.version,
        publishConfig: { registry: "https://registry.example.test" },
      })
    );
    await Bun.write(
      path.join(root, "packages/stable/package.json"),
      JSON.stringify({ name: "stable", version: "1.0.0+build-meta" })
    );
    await Bun.write(
      path.join(root, "apps/private/package.json"),
      JSON.stringify({
        name: "private",
        version: "1.0.0-beta.1",
        private: true,
      })
    );
    expect(await publicPrereleases(root)).toEqual([
      {
        name: beta.name,
        version: beta.version,
        directory: path.join(root, "packages/cli"),
        registry: "https://registry.example.test",
      },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
