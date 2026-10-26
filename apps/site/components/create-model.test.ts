import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";
import {
  createCommand,
  readInstallationSelection,
  startingInstallation,
} from "./create-model";

const gateways = [
  { id: "vercel", title: "Vercel" },
  { id: "openrouter", title: "OpenRouter" },
];
const storage = [
  { id: "vercel-blob", title: "Vercel Blob" },
  { id: "s3", title: "S3", configKeys: ["bucket", "region"] },
];

void describe("ChatJS installation handoff", () => {
  void test("keeps native preset encoding opaque while passing existing installation arguments", () => {
    const preset = {
      ...DEFAULT_PRESET_CONFIG,
      theme: "rose",
      font: "inter",
      fontHeading: "lora",
      chartColor: "blue",
      radius: "large",
    } as const;
    const installation = {
      ...startingInstallation,
      gateway: "openrouter",
      plugins: ["attachment-uploads"],
      storage: { source: "s3", options: {} },
    };
    assert.equal(
      createCommand(preset, "base", installation),
      `bunx @chat-js/cli@beta create my-chat --yes --gateway openrouter --attachments --storage-provider s3 --sandbox-provider vercel -- --preset ${encodePreset(preset)} --base base`
    );
  });
  void test("accepts only provider public config and safely quotes native CLI JSON", () => {
    const options = { bucket: "my-app-files", region: "us-east-1" };
    const query = new URLSearchParams({
      storage: "s3",
      "storage-config": JSON.stringify(options),
    });
    const installation = {
      ...startingInstallation,
      storage: { source: "s3", options },
    };
    assert.deepEqual(
      readInstallationSelection(query, gateways, storage),
      installation
    );
    assert.match(
      createCommand(DEFAULT_PRESET_CONFIG, "base", installation),
      /--storage-config '\{"bucket":"my-app-files","region":"us-east-1"\}'/u
    );
    for (const config of [
      JSON.stringify({ accessKeyId: "private" }),
      "not-json",
      JSON.stringify({ bucket: 1 }),
    ]) {
      query.set("storage-config", config);
      assert.equal(readInstallationSelection(query, gateways, storage), null);
    }
  });
  void test("rejects unavailable installation choices and leaves theme parsing to upstream", () => {
    for (const query of ["gateway=missing", "storage=memory", "uploads=yes"]) {
      assert.equal(
        readInstallationSelection(
          new URLSearchParams(query),
          gateways,
          storage
        ),
        null
      );
    }
    assert.deepEqual(
      readInstallationSelection(
        new URLSearchParams("preset=opaque&base=radix"),
        gateways,
        storage
      ),
      startingInstallation
    );
  });
});

void test("upload links select a persistent sandbox and remove it when uploads are disabled", () => {
  const query = new URLSearchParams("uploads=true");
  const selected = readInstallationSelection(query, gateways, storage);
  assert.equal(selected?.sandbox, "vercel");
  assert.notEqual(selected, null);
  if (selected === null) {
    throw new Error("Expected upload selection");
  }
  assert.match(
    createCommand(DEFAULT_PRESET_CONFIG, "base", selected),
    /--sandbox-provider vercel/u
  );
  query.set("uploads", "false");
  const minimal = readInstallationSelection(query, gateways, storage);
  assert.notEqual(minimal, null);
  if (minimal === null) {
    throw new Error("Expected minimal selection");
  }
  assert.equal(minimal.sandbox, undefined);
  assert.doesNotMatch(
    createCommand(DEFAULT_PRESET_CONFIG, "base", minimal),
    /--sandbox-provider/u
  );
});

void test("passes Radix through unchanged beside the opaque native preset", () => {
  assert.match(
    createCommand(DEFAULT_PRESET_CONFIG, "radix", startingInstallation),
    new RegExp(
      `-- --preset ${encodePreset(DEFAULT_PRESET_CONFIG)} --base radix$`,
      "u"
    )
  );
});
