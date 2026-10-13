import { cp, mkdir, symlink } from "node:fs/promises";
import path from "node:path";

const controllerCommit = "49385ae69";
const expectedHashes = new Map([
  [
    "fixture.ts",
    "c457251f567b2d78820f1fb42da1b8a9f255816607ab84a3d9b9f5e7d3f1c62e",
  ],
  [
    "persistent-runtime.ts",
    "56f3d62106a5a3c49d9c044e87baa6833aad455d5af3ea98a05698b902020aed",
  ],
  [
    "postgres-fixture.ts",
    "be39695de991d184772f27151b2941d022c524f0243ad5d6b0e84989fb52d15f",
  ],
]);
const argumentIndex = 2;
const source = process.argv[argumentIndex];
if (!source) {
  throw new Error("Supply Lane D's tests/eve-retirement-runtime directory");
}
const target = path.resolve("apps/chat/.eve/lane-c-pg-shared");
await mkdir(target, { recursive: true });
const files = await Promise.all(
  ["fixture.ts", "persistent-runtime.ts", "postgres-fixture.ts"].map(
    async (name) => {
      const input = path.resolve(source, name);
      const contents = await Bun.file(input).arrayBuffer();
      const sha256 = new Bun.CryptoHasher("sha256")
        .update(contents)
        .digest("hex");
      if (sha256 !== expectedHashes.get(name)) {
        throw new Error(
          `Expected ${name} from shared controller ${controllerCommit}`
        );
      }
      await cp(input, path.join(target, name));
      return { name, sha256 };
    }
  )
);
const provider = path.resolve(
  "apps/chat/node_modules/@workflow/world-postgres"
);
if (!(await Bun.file(path.join(provider, "package.json")).exists())) {
  await mkdir(path.dirname(provider), { recursive: true });
  await symlink(
    path.resolve("node_modules/@workflow/world-postgres"),
    provider
  );
}
await Bun.write(
  path.join(target, "controller-provenance.json"),
  JSON.stringify({
    commit: controllerCommit,
    files,
    source: path.resolve(source),
  })
);
