// oxlint-disable-next-line import/no-nodejs-modules -- Copy the unchanged shared controller into this lane's ignored runtime area.
import { access, cp, mkdir, symlink } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve caller-supplied local harness paths.
import path from "node:path";

const argumentIndex = 2;
const source = process.argv[argumentIndex];
if (!source) {
  throw new Error(
    "Supply the absolute Lane D tests/eve-retirement-runtime directory"
  );
}
const target = path.resolve("apps/chat/.eve/lane-c-shared");
await mkdir(target, { recursive: true });
await Promise.all(
  ["fixture.ts", "persistent-runtime.ts"].map(async (name) => {
    await cp(path.resolve(source, name), path.join(target, name));
  })
);
const link = path.join(target, "node_modules");
const exists = await access(link).then(
  () => true,
  () => false
);
if (!exists) {
  await symlink(
    path.resolve("apps/chat/.eve/lane-c-stock-deps/node_modules"),
    link
  );
}
