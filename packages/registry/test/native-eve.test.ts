import { expect, test } from "bun:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { registryItemSchema } from "shadcn/schema";
import { run } from "../../cli/test/run-command";
import registryPackage from "../package.json";

// Opt-in integration suite: actual EVE installer, isolated dependencies, discovery
// and compiler. No ChatJS application, aliases, credentials or service calls.
test("EVE installs and discovers portable capabilities", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-portable-eve-"));
  const root = path.resolve(import.meta.dir, "..");
  const files = new Map<string, string>(
    await Promise.all(
      ["registry", "word-count", "get-weather", "deep-research"].map(
        async (name) =>
          [
            `/${name}.json`,
            await readFile(
              path.join(root, "dist/r/eve", `${name}.json`),
              "utf-8"
            ),
          ] as const
      )
    )
  );
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
      const content = files.get(new URL(request.url).pathname);
      return content === undefined
        ? new Response("Not found", { status: 404 })
        : new Response(content, {
            headers: { "content-type": "application/json" },
          });
    },
  });
  try {
    await mkdir(path.join(directory, "agent"));
    await writeFile(
      path.join(directory, "agent/instructions.md"),
      "Use the installed capabilities to answer the user.\n"
    );
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({
        name: "native-capability-fixture",
        private: true,
        type: "module",
        packageManager: `bun@${Bun.version}`,
        dependencies: { eve: registryPackage.devDependencies.eve },
        devDependencies: {
          typescript: registryPackage.devDependencies.typescript,
          "@types/node": registryPackage.devDependencies["@types/node"],
        },
      })
    );
    await writeFile(
      path.join(directory, "agent/agent.ts"),
      'import { defineAgent } from "eve";\nexport default defineAgent({ model: "openai/gpt-5-mini", defaultTools: false });\n'
    );
    await writeFile(
      path.join(directory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          types: ["node"],
        },
        include: ["agent/**/*.ts"],
      })
    );
    await run(directory, ["bun", "install"]);
    const eve = path.join(directory, "node_modules/eve/bin/eve.js");
    for (const id of ["word-count", "get-weather", "deep-research"]) {
      // oxlint-disable-next-line no-await-in-loop -- Both installer operations mutate the same project's dependency graph.
      await run(directory, [
        "node",
        eve,
        "add",
        `${server.url}${id}.json`,
        "--non-interactive",
        "--yes",
      ]);
      const item = registryItemSchema.parse(
        JSON.parse(files.get(`/${id}.json`) ?? "")
      );
      for (const file of item.files ?? []) {
        if (file.target === undefined || file.content === undefined) {
          throw new Error("Missing native file target");
        }
        const installed =
          // oxlint-disable-next-line no-await-in-loop -- Check each installed source before the next installer mutation.
          await readFile(
            path.join(directory, file.target.replace(/^~\//u, "")),
            "utf-8"
          );
        expect(installed).toBe(file.content);
      }
    }
    await run(directory, ["bunx", "--no-install", "tsc", "--noEmit"]);
    const info = Bun.spawn(["node", eve, "info", "--json"], {
      cwd: directory,
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(info.stdout).text(),
      new Response(info.stderr).text(),
      info.exited,
    ]);
    expect(exitCode, stderr).toBe(0);
    const discovered = z
      .object({ tools: z.array(z.string()) })
      .parse(JSON.parse(stdout));
    expect(discovered.tools).toContain("wordCount");
    expect(discovered.tools).toContain("getWeather");
    expect(discovered.tools).toContain("deepResearch");
    await run(directory, ["node", eve, "build"]);
  } finally {
    await server.stop(true);
    if (process.env.CHATJS_KEEP_NATIVE_FIXTURE === "1") {
      process.stdout.write(`Portable EVE fixture: ${directory}\n`);
    } else {
      await rm(directory, { recursive: true, force: true });
    }
  }
});
