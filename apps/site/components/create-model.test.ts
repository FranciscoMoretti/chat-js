import {
  encodeInstallationInput,
  decodeAppPreset,
} from "../../../packages/registry/app-preset";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PRESET_CONFIG, encodePreset } from "shadcn/preset";
import {
  createCommand,
  encodeInstallationQuery,
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
  void test("keeps native preset encoding opaque while passing the complete installation", () => {
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
      `bunx chat-js@alpha create my-chat --yes --app-preset ${encodeInstallationInput(installation).code} -- --preset ${encodePreset(preset)} --base base`
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
  assert.equal(
    decodeAppPreset(encodeInstallationInput(selected).code).sandbox,
    "vercel"
  );
  query.set("uploads", "false");
  const minimal = readInstallationSelection(query, gateways, storage);
  assert.notEqual(minimal, null);
  if (minimal === null) {
    throw new Error("Expected minimal selection");
  }
  assert.equal(minimal.sandbox, undefined);
  assert.equal(
    decodeAppPreset(encodeInstallationInput(minimal).code).sandbox,
    undefined
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

void test("full installation URL survives reload independently from preview scenario", () => {
  const selection = {
    plugins: ["feedback", "projects"],
    tools: ["get-weather"],
    gateway: "openrouter",
    sandbox: "daytona",
    storage: { source: "s3", options: { bucket: "public-files" } },
  };
  const query = new URLSearchParams({
    installation: JSON.stringify(selection),
    scenario: "mutation-error",
  });
  assert.deepEqual(
    readInstallationSelection(query, gateways, storage),
    selection
  );
  query.set("scenario", "ready");
  assert.deepEqual(
    readInstallationSelection(query, gateways, storage),
    selection
  );
  query.set("installation", "broken");
  assert.equal(readInstallationSelection(query, gateways, storage), null);
});

void test("exports explicit empty arrays without convenience defaults or demo scenario", () => {
  const command = createCommand(
    DEFAULT_PRESET_CONFIG,
    "base",
    startingInstallation
  );
  const code = /--app-preset (?<code>a[0-9A-Za-z]+)/u.exec(command)?.groups
    ?.code;
  assert.ok(code !== undefined);
  assert.deepEqual(decodeAppPreset(code), startingInstallation);
  assert.doesNotMatch(command, /--projects|--attachments|scenario/u);
});

void test("compact links preserve custom storage values and reject unsupported presets", () => {
  const selection = {
    ...startingInstallation,
    storage: { source: "s3", options: { bucket: "team files" } },
  };
  const { code, storageConfig } = encodeInstallationInput(selection);
  const query = new URLSearchParams({
    app: code,
    "storage-config": storageConfig ?? "",
  });
  assert.deepEqual(
    readInstallationSelection(query, gateways, storage),
    selection
  );
  query.set("app", "z0");
  assert.equal(readInstallationSelection(query, gateways, storage), null);
});

void test("URL encoding preserves explicit choices and removes stale provider values", () => {
  const selection = {
    ...startingInstallation,
    tools: ["deep-research"],
    storage: { source: "s3", options: { bucket: "public files" } },
  };
  const encoded = encodeInstallationQuery(selection);
  assert.match(encoded.app ?? "", /^a[0-9A-Za-z]+$/u);
  const query = new URLSearchParams({
    gateway: "old",
    uploads: "true",
    storage: "s3",
    "storage-config": "old",
  });
  for (const [key, value] of Object.entries(encoded)) {
    if (value === null) {
      query.delete(key);
    } else {
      query.set(key, value);
    }
  }
  assert.deepEqual(
    readInstallationSelection(query, gateways, storage),
    selection
  );
  assert.deepEqual([...query.keys()].toSorted(), ["app", "storage-config"]);
  assert.equal(
    encodeInstallationQuery(startingInstallation)["storage-config"],
    null
  );
});

void test("imported unknown selections remain losslessly editable", () => {
  const selection = { ...startingInstallation, plugins: ["unknown-plugin"] };
  const encoded = encodeInstallationQuery(selection);
  assert.deepEqual(
    readInstallationSelection(
      new URLSearchParams({ installation: encoded.installation ?? "" }),
      gateways,
      storage
    ),
    selection
  );
});

void test("legacy compact links migrate to app and conflicting inputs are rejected", () => {
  const legacy = new URLSearchParams({ installation: "a9p" });
  const selection = readInstallationSelection(legacy, gateways, storage);
  assert.deepEqual(selection, startingInstallation);
  assert.equal(encodeInstallationQuery(startingInstallation).app, "a9p");
  assert.equal(
    encodeInstallationQuery(startingInstallation).installation,
    null
  );
  legacy.set("app", "a1");
  assert.equal(readInstallationSelection(legacy, gateways, storage), null);
  assert.equal(
    readInstallationSelection(
      new URLSearchParams({ app: JSON.stringify(startingInstallation) }),
      gateways,
      storage
    ),
    null
  );
});
