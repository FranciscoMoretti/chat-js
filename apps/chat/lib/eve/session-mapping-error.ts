type EveSessionMappingErrorCode =
  | "unauthenticated"
  | "identity_pending"
  | "identity_missing"
  | "owner_mismatch"
  | "identity_deleted"
  | "binding_conflict"
  | "receipt_pending"
  | "receipt_unavailable";

/* oxlint-disable import/no-named-export, import/prefer-default-export --
 * import/no-named-export (#527): Preserve the named EveSessionMappingError API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): EveSessionMappingError remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 */
export class EveSessionMappingError extends Error {
  public readonly code: EveSessionMappingErrorCode;

  public constructor(code: EveSessionMappingErrorCode) {
    super(`Conversation session mapping: ${code}.`);
    this.name = "EveSessionMappingError";
    this.code = code;
  }
}
/* oxlint-enable import/no-named-export, import/prefer-default-export */
