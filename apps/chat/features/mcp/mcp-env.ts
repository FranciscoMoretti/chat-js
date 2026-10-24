const ENCRYPTION_KEY_BYTES = 32;
const KEY_FORMAT_MESSAGE = "MCP_ENCRYPTION_KEY must encode a 32-byte key.";

const isValidEncryptionKey = (key: string | undefined): key is string => {
  if (key === undefined) {
    return false;
  }
  const decoded = Buffer.from(key, "base64");
  return (
    decoded.length === ENCRYPTION_KEY_BYTES &&
    decoded.toString("base64") === key
  );
};

const validateEnvironment = (env: Readonly<NodeJS.ProcessEnv>): string[] =>
  isValidEncryptionKey(env.MCP_ENCRYPTION_KEY) ? [] : [KEY_FORMAT_MESSAGE];

/** Read only when encrypting/decrypting; schema generation needs no credentials. */
const readMcpEncryptionKey = (): string => {
  const key = process.env.MCP_ENCRYPTION_KEY;
  if (!isValidEncryptionKey(key)) {
    throw new Error(KEY_FORMAT_MESSAGE);
  }
  return key;
};
export { readMcpEncryptionKey, validateEnvironment };
