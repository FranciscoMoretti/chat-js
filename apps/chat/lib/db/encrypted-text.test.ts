import { pgTable } from "drizzle-orm/pg-core";
import { expect, test, vi } from "vitest";

import { encryptedJson, encryptedText } from "./encrypted-text";

const { encryptionKey } = vi.hoisted(() => {
  const AES_256_KEY_BYTES = 32;
  return { encryptionKey: Buffer.alloc(AES_256_KEY_BYTES).toString("base64") };
});

vi.mock("@/lib/env", (): { env: { MCP_ENCRYPTION_KEY: string } } => ({
  env: {
    MCP_ENCRYPTION_KEY: encryptionKey,
  },
}));
const table = pgTable("encrypted_fixture", {
  json: encryptedJson("json"),
  text: encryptedText("text"),
});

test("encrypted OAuth envelopes preserve arbitrary object fields", (): void => {
  const value = {
    access_token: "secret",
    extensions: { nested: [true, "value"] },
  };
  expect(
    table.json.mapFromDriverValue(table.json.mapToDriverValue(value))
  ).toEqual(value);
});

test("authenticated ciphertext still requires a JSON object envelope", (): void => {
  for (const plaintext of ["null", "[]", '"text"', "false"]) {
    const ciphertext = table.text.mapToDriverValue(plaintext);
    expect(() => table.json.mapFromDriverValue(ciphertext)).toThrow(TypeError);
  }
  expect(() => table.json.mapFromDriverValue("invalid-ciphertext")).toThrow();
});
