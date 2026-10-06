/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { customType } from "drizzle-orm/pg-core";

import { env } from "@/lib/env";
/* oxlint-enable import/no-nodejs-modules */

const ALGORITHM = "aes-256-gcm";

const getKey = (): Buffer => {
  const key = env.MCP_ENCRYPTION_KEY;
  if (typeof key !== "string" || key === "") {
    throw new Error("MCP_ENCRYPTION_KEY is not configured");
  }
  return Buffer.from(key, "base64");
};

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): encrypt uses 16 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
const encrypt = (plaintext: string): string => {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
};
/* oxlint-enable no-magic-numbers */

const decrypt = (encrypted: string): string => {
  const key = getKey();
  const [ivB64, authTagB64, dataB64] = encrypted.split(":");
  if (!(ivB64 && authTagB64 && dataB64)) {
    throw new Error("Invalid encrypted text format");
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return decipher.update(dataB64, "base64", "utf-8") + decipher.final("utf-8");
};

/**
 * Custom Drizzle type for encrypted text fields.
 * Automatically encrypts on write and decrypts on read using AES-256-GCM.
 */
const encryptedText = customType<{ driverData: string; data: string }>({
  dataType: (): string => "text",
  fromDriver: (value): string => decrypt(value),
  toDriver: (value): string => encrypt(value),
});

/**
 * Custom Drizzle type for encrypted JSON fields.
 * Automatically encrypts on write and decrypts on read using AES-256-GCM.
 * Stores JSON as encrypted text in the database.
 * @returns {ReturnType<typeof customType<{ driverData: string; data: JsonValue }>>} Native column factory whose driver conversion encrypts serialized JSON and decrypts/parses it without runtime schema validation.
 */
const encryptedJson = <JsonValue>(): ReturnType<
  typeof customType<{ driverData: string; data: JsonValue }>
> =>
  customType<{ driverData: string; data: JsonValue }>({
    dataType: (): string => "text",
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Encrypted JSON columns are typed by their Drizzle declaration; adding per-column runtime schemas requires a database serialization contract migration.
    fromDriver: (value): JsonValue => JSON.parse(decrypt(value)) as JsonValue,
    toDriver: (value): string => encrypt(JSON.stringify(value)),
  });
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (encryptedJson, encryptedText); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { encryptedJson, encryptedText };
/* oxlint-enable import/no-named-export */
