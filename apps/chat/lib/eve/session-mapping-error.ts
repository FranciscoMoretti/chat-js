type EveSessionMappingErrorCode =
  | "unauthenticated"
  | "identity_pending"
  | "identity_missing"
  | "owner_mismatch"
  | "identity_deleted"
  | "binding_conflict"
  | "receipt_pending"
  | "receipt_unavailable";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveSessionMappingError); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export class EveSessionMappingError extends Error {
  public readonly code: EveSessionMappingErrorCode;

  public constructor(code: EveSessionMappingErrorCode) {
    super(`Conversation session mapping: ${code}.`);
    this.name = "EveSessionMappingError";
    this.code = code;
  }
}
/* oxlint-enable import/prefer-default-export, import/no-named-export */
