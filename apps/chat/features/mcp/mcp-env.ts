const ENCRYPTION_KEY_BYTES = 32;
const KEY_FORMAT_MESSAGE = "MCP_ENCRYPTION_KEY must encode a 32-byte key.";

const validateEnvironment = (env: Readonly<NodeJS.ProcessEnv>): string[] => {
  const key = env.MCP_ENCRYPTION_KEY;
  return typeof key === "string" &&
    Buffer.from(key, "base64").length === ENCRYPTION_KEY_BYTES
    ? []
    : [KEY_FORMAT_MESSAGE];
};

/** Read only when encrypting/decrypting; schema generation needs no credentials. */
const readMcpEncryptionKey = (): string => {
  const key = process.env.MCP_ENCRYPTION_KEY;
  if (key === undefined || validateEnvironment(process.env).length > 0) {
    throw new Error(KEY_FORMAT_MESSAGE);
  }
  return key;
};
export { readMcpEncryptionKey, validateEnvironment };
