const deletionSessionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/(?<operation>reset|stream|sandbox-identity)$/u;

/** Internal deletion may retire and inspect; it must never start new work. */
export const parseDeletionSessionRequest = (path: string, method: string) => {
  const match = deletionSessionPath.exec(path);
  return match &&
    ((match[2] === "reset" && method === "POST") ||
      ((match[2] === "stream" || match[2] === "sandbox-identity") &&
        method === "GET"))
    ? match[1]
    : null;
};
