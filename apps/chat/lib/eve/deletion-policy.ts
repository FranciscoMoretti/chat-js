const deletionSessionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/(?<operation>reset|stream|sandbox-identity)$/u;

const SESSION_ID_GROUP_INDEX = 1;
const OPERATION_GROUP_INDEX = 2;

/* oxlint-disable unicorn/no-null -- * unicorn/no-null (#570): parseDeletionSessionRequest preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
/**
 * Internal deletion may retire and inspect; it must never start new work.
 * @param {string} path Native session endpoint requested under deletion authorization.
 * @param {string} method HTTP method that must match reset or read-only stream/sandbox inspection.
 * @returns {string | null} The matched native session ID for an allowed request, or null for any other path/method.
 */
export const parseDeletionSessionRequest = (
  path: string,
  method: string
): string | null => {
  const match = deletionSessionPath.exec(path);
  return match &&
    ((match[OPERATION_GROUP_INDEX] === "reset" && method === "POST") ||
      ((match[OPERATION_GROUP_INDEX] === "stream" ||
        match[OPERATION_GROUP_INDEX] === "sandbox-identity") &&
        method === "GET"))
    ? match[SESSION_ID_GROUP_INDEX]
    : null;
};
/* oxlint-enable unicorn/no-null */
