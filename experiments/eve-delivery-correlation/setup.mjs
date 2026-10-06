import { mkdir, writeFile, access } from "node:fs/promises";
import { resolve } from "node:path";
const area = resolve("apps/chat/.eve");
await mkdir(area, { recursive: true });
const run = async (args, cwd) => {
  const proc = Bun.spawn(args, { cwd, stdout: "inherit", stderr: "inherit" });
  if ((await proc.exited) !== 0)
    throw new Error(`Command failed: ${args.join(" ")}`);
};
for (const name of ["lane-c-deps", "lane-c-stock-deps"]) {
  const dir = resolve(area, name);
  await mkdir(dir, { recursive: true });
  await writeFile(
    resolve(dir, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: { eve: "0.71.3", ai: "7.0.106", zod: "4.3.6" },
    })
  );
  await run(["bun", "install"], dir);
}
const checkout = resolve(area, "lane-c-runtime");
if (
  !(await access(resolve(checkout, ".git")).then(
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
if (
  (await new Response(head.stdout).text()).trim() !==
  "fab8ba1424eddfdedd6a177cac21710258da0e81"
)
  throw new Error("Unexpected eve source commit");
const patch = resolve("experiments/eve-delivery-correlation/runtime.patch");
const alreadyApplied = Bun.spawn(
  ["git", "apply", "--reverse", "--check", patch],
  { cwd: checkout, stdout: "ignore", stderr: "ignore" }
);
if ((await alreadyApplied.exited) !== 0)
  await run(["git", "apply", patch], checkout);
await run(["bun", "experiments/eve-delivery-correlation/install-patch.mjs"]);
