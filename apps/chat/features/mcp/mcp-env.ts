/** Read only when encrypting/decrypting; schema generation needs no credentials. */
const ENCRYPTION_KEY_BYTES = 32;
const readMcpEncryptionKey = (): string => {
  const key = process.env.MCP_ENCRYPTION_KEY;
  if (
    typeof key !== "string" ||
    Buffer.from(key, "base64").length !== ENCRYPTION_KEY_BYTES
  ) {
    throw new Error("MCP_ENCRYPTION_KEY must encode a 32-byte key.");
  }
  return key;
};
export { readMcpEncryptionKey };
