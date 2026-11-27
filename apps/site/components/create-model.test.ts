import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_PRESET_CONFIG } from "shadcn/preset";
import { decodeAppPreset } from "../../../packages/registry/app-preset";
import { agentConfigurationSchema } from "../../../packages/registry/agent-configuration";
import {
  createCommand,
  encodeInstallationQuery,
  readInstallationSelection,
  startingInstallation,
} from "./create-model";

const gateways = [{ id: "vercel", title: "Vercel" }];
const storage = [
  { id: "vercel-blob", title: "Blob" },
  {
    id: "s3",
    title: "S3",
    fields: [{ key: "bucket", label: "bucket", type: "text" as const }],
  },
];

void test("Create exports the same authored agent through URLs and shell commands", () => {
  const selection = {
    ...startingInstallation,
    agent: agentConfigurationSchema.parse({
      model: "test/model",
    }),
    storage: { source: "s3", options: { bucket: "team files" } },
  };
  assert.deepEqual(
    readInstallationSelection(
      new URLSearchParams(encodeInstallationQuery(selection)),
      gateways,
      storage
    ),
    selection
  );
  const command = createCommand(DEFAULT_PRESET_CONFIG, "base", selection);
  const encoded = /--app-preset (?<code>agent1_[A-Za-z0-9_-]+)/u.exec(command)
    ?.groups?.code;
  assert.ok(encoded !== undefined);
  assert.deepEqual(decodeAppPreset(encoded ?? ""), selection);
  assert.ok(!command.includes("--storage-config"));
});

void test("empty, invalid and unknown selections remain explicit", () => {
  assert.deepEqual(
    readInstallationSelection(new URLSearchParams(), gateways, storage),
    startingInstallation
  );
  assert.equal(
    readInstallationSelection(
      new URLSearchParams({ app: "a9p" }),
      gateways,
      storage
    ),
    null
  );
  const custom = { ...startingInstallation, tools: ["@custom/tool"] };
  assert.deepEqual(
    readInstallationSelection(
      new URLSearchParams(encodeInstallationQuery(custom)),
      gateways,
      storage
    ),
    custom
  );
  const invalid = {
    ...startingInstallation,
    storage: { source: "s3", options: { secretAccessKey: "not-public" } },
  };
  assert.equal(
    readInstallationSelection(
      new URLSearchParams(encodeInstallationQuery(invalid)),
      gateways,
      storage
    ),
    null
  );
});
