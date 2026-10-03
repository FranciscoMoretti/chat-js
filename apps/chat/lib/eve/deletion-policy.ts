const deletionSessionPath =
  /^\/eve\/v1\/session\/(?<sessionId>[A-Za-z0-9_-]+)\/(?<operation>reset|stream|sandbox-identity)$/u;

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null  --
 * import/no-named-export (#527): Preserve the named parseDeletionSessionRequest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): parseDeletionSessionRequest remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): parseDeletionSessionRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): parseDeletionSessionRequest's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-magic-numbers (#517): parseDeletionSessionRequest uses 2, 1 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): parseDeletionSessionRequest derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/explicit-function-return-type (#560): Keep parseDeletionSessionRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep parseDeletionSessionRequest's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): parseDeletionSessionRequest preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */
