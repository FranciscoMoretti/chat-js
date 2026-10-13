import { access, cp, mkdir, symlink } from "node:fs/promises";
import path from "node:path";

const controllerCommit = "7a312a5448fb88403897217b3998cd0b775ee5c2";
const controllerFiles = [
  {
    name: "fixture.ts",
    sha256: "8af5c23ba4e83386f471876ffa9754ac0ffce9ea14c28882d0a4e2c7e4c222e0",
  },
  {
    name: "persistent-runtime.ts",
    sha256: "509b1d4fe4b03cd7e48b3c52c5af310d76231e8ba49939f0b98b0d4c353c1552",
  },
];
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
  controllerFiles.map(
    async ({ name, sha256 }: Readonly<{ name: string; sha256: string }>) => {
      const contents = await Bun.file(path.resolve(source, name)).arrayBuffer();
      const actual = new Bun.CryptoHasher("sha256")
        .update(contents)
        .digest("hex");
      if (actual !== sha256) {
        throw new Error(`Expected ${name} from controller ${controllerCommit}`);
      }
      await cp(path.resolve(source, name), path.join(target, name));
    }
  )
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

await Bun.write(
  path.join(target, "controller-provenance.json"),
  JSON.stringify({ commit: controllerCommit, files: controllerFiles })
);
