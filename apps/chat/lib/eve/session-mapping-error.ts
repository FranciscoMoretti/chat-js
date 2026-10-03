type EveSessionMappingErrorCode =
  | "unauthenticated"
  | "identity_pending"
  | "identity_missing"
  | "owner_mismatch"
  | "identity_deleted"
  | "binding_conflict"
  | "receipt_pending"
  | "receipt_unavailable";

export class EveSessionMappingError extends Error {
  public readonly code: EveSessionMappingErrorCode;

  public constructor(code: EveSessionMappingErrorCode) {
    super(`Conversation session mapping: ${code}.`);
    this.name = "EveSessionMappingError";
    this.code = code;
  }
}
