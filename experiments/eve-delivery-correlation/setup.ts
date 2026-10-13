import { mkdir, writeFile, access, symlink } from "node:fs/promises";
import path from "node:path";

const successExitCode = 0;

const area = path.resolve("apps/chat/.eve");
await mkdir(area, { recursive: true });
const run = async (args: readonly string[], cwd?: string): Promise<void> => {
  const proc = Bun.spawn([...args], {
    cwd,
    stderr: "inherit",
    stdout: "inherit",
  });
  if ((await proc.exited) !== successExitCode) {
    throw new Error(`Command failed: ${args.join(" ")}`);
  }
};
await Promise.all(
  ["lane-c-deps", "lane-c-stock-deps"].map(async (name) => {
    const dir = path.resolve(area, name);
    await mkdir(dir, { recursive: true });
    await writeFile(
      path.resolve(dir, "package.json"),
      JSON.stringify({
        dependencies: { ai: "7.0.106", eve: "0.71.3", zod: "4.3.6" },
        private: true,
        type: "module",
      })
    );
    await run(["bun", "install"], dir);
  })
);
const checkout = path.resolve(area, "lane-c-runtime");
if (
  !(await access(path.resolve(checkout, ".git")).then(
    () => true,
    () => false
  ))
) {
  await run([
    "git",
    "clone",
    "--depth",
    "1",
    "--branch",
    "eve@0.71.3",
    "https://github.com/vercel/eve.git",
    checkout,
  ]);
}
const head = Bun.spawn(["git", "rev-parse", "HEAD"], {
  cwd: checkout,
  stdout: "pipe",
});
const headText = await new Response(head.stdout).text();
if (headText.trim() !== "fab8ba1424eddfdedd6a177cac21710258da0e81") {
  throw new Error("Unexpected eve source commit");
}
const patch = path.resolve(
  "experiments/eve-delivery-correlation/runtime.patch"
);
const alreadyApplied = Bun.spawn(
  ["git", "apply", "--reverse", "--check", patch],
  { cwd: checkout, stderr: "ignore", stdout: "ignore" }
);
if ((await alreadyApplied.exited) !== successExitCode) {
  await run(["git", "apply", patch], checkout);
}
await run(["bun", "experiments/eve-delivery-correlation/install-patch.ts"]);

const dependencyLink = path.resolve(
  "experiments/eve-delivery-correlation/node_modules"
);
const linkExists = await access(dependencyLink).then(
  () => true,
  () => false
);
if (!linkExists) {
  await symlink(path.resolve(area, "lane-c-deps/node_modules"), dependencyLink);
}
