import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { it } from "bun:test";
import { writeEvePackageManifests } from "../../../scripts/test-eve-manifests";

const archive = "/tmp/chat-js-eve.tgz";
const originals = [
  {
    content: JSON.stringify({
      dependencies: { eve: "workspace:*", other: "1" },
    }),
    file: "apps/chat/package.json",
  },
  {
    content: JSON.stringify({ dependencies: { eve: "workspace:*" } }),
    file: "apps/chat/tests/eve-fixture/package.json",
  },
];

it.each(["{", "null", "{}", '{"dependencies":null}', '{"dependencies":[]}'])(
  "validates every manifest before starting any writes: %s",
  async (content) => {
    let writeStarted = false;
    await assert.rejects(
      writeEvePackageManifests(
        [originals[0], { ...originals[1], content }],
        archive,
        () => {
          writeStarted = true;
          assert.fail("Validation must finish before writing any manifest");
        }
      ),
      content === "{"
        ? { name: "SyntaxError" }
        : { message: `Expected dependencies in ${originals[1].file}` }
    );
    assert.equal(writeStarted, false);
  }
);

it.each([false, true])(
  "settles every write before failure restoration (later write rejects: %s)",
  async (laterWriteRejects) => {
    const firstWrite = Promise.withResolvers<null>();
    const laterWrite = Promise.withResolvers<null>();
    const failure = new Error("First write failed");
    const persisted = new Map(
      originals.map(({ content, file }) => [file, content])
    );
    const events: string[] = [];
    const writeAndRestore = async (): Promise<void> => {
      try {
        await writeEvePackageManifests(
          originals,
          archive,
          async (file, content) => {
            events.push(`start:${file}`);
            await (file === originals[0].file
              ? firstWrite.promise
              : laterWrite.promise);
            persisted.set(file, content);
            events.push(`finish:${file}`);
          }
        );
      } finally {
        events.push("restore");
        for (const { content, file } of originals) {
          persisted.set(file, content);
        }
      }
    };
    const result = assert.rejects(writeAndRestore(), failure);
    assert.deepEqual(
      events,
      originals.map(({ file }) => `start:${file}`)
    );
    firstWrite.reject(failure);
    // Let rejection handlers run while the second write remains controlled.
    await setImmediate();
    assert.equal(events.includes("restore"), false);
    if (laterWriteRejects) {
      laterWrite.reject(new Error("Later write failed"));
    } else {
      laterWrite.resolve(null);
    }
    await result;
    assert.equal(events.at(-1), "restore");
    assert.deepEqual(
      persisted,
      new Map(originals.map(({ content, file }) => [file, content]))
    );
  }
);
