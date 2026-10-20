const deletionSessionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/(?<operation>reset|stream)$/u;

const SESSION_ID_GROUP_INDEX = 1;
const OPERATION_GROUP_INDEX = 2;

/**
 * Internal deletion may retire and inspect; it must never start new work.
 * @param {string} path Native session endpoint requested under deletion authorization.
 * @param {string} method HTTP method that must match reset or read-only stream inspection.
 * @returns {string | null} The matched native session ID for an allowed request, or null for any other path/method.
 */
export const parseDeletionSessionRequest = (
  path: string,
  method: string
): string | null => {
  const match = deletionSessionPath.exec(path);

  if (
    match &&
    ((match[OPERATION_GROUP_INDEX] === "reset" && method === "POST") ||
      (match[OPERATION_GROUP_INDEX] === "stream" && method === "GET"))
  ) {
    return match[SESSION_ID_GROUP_INDEX];
  }
  return null;
};
