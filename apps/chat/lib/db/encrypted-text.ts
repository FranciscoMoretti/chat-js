/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This server/tooling module requires import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { customType } from "drizzle-orm/pg-core";

import { env } from "@/lib/env";
/* oxlint-enable import/no-nodejs-modules */

const ALGORITHM = "aes-256-gcm";

/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): getKey intentionally keeps the existing falsy-value behavior of key; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const getKey = (): Buffer => {
  const key = env.MCP_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("MCP_ENCRYPTION_KEY is not configured");
  }
  return Buffer.from(key, "base64");
};
/* oxlint-enable typescript/strict-boolean-expressions */

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

/* oxlint-disable id-length, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- id-length (#506): encryptedJson uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
jsdoc/require-returns (#535): encryptedJson's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/explicit-function-return-type (#560): Keep encryptedJson's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep encryptedJson's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary. */
/**
 * Custom Drizzle type for encrypted JSON fields.
 * Automatically encrypts on write and decrypts on read using AES-256-GCM.
 * Stores JSON as encrypted text in the database.
 */
const encryptedJson = <T>() =>
  customType<{ driverData: string; data: T }>({
    dataType: (): string => "text",
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- #599: Encrypted JSON columns are typed by their Drizzle declaration; adding per-column runtime schemas requires a database serialization contract migration.
    fromDriver: (value) => JSON.parse(decrypt(value)) as T,
    toDriver: (value): string => encrypt(JSON.stringify(value)),
  });
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (encryptedJson, encryptedText); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable id-length, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
export { encryptedJson, encryptedText };
/* oxlint-enable import/no-named-export */
