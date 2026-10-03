/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named MigrationIdentity API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface MigrationIdentity {
  createdAt: number;
  hash: string;
}
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): KNOWN_CHATJS_TABLE_NAMES stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named KNOWN_CHATJS_TABLE_NAMES API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** Tables from the EVE-only baseline plus every retired ChatJS table. */
export const KNOWN_CHATJS_TABLE_NAMES = [
  "account",
  "EveChat",
  "EveChatProject",
  "EveCodeSandbox",
  "EveConversation",
  "EveConversationCopy",
  "EveConversationCopyFile",
  "EveDocumentCheckpoint",
  "EveDocumentCheckpointEntry",
  "EveDocumentHead",
  "EveDocumentRevision",
  "EveFileReference",
  "EveGuest",
  "EveGuestMessage",
  "EveGuestRate",
  "EveImportedDocumentCheckpoint",
  "EveImportedDocumentCheckpointEntry",
  "EveNamedDocumentCheckpoint",
  "EveNamedDocumentCheckpointEntry",
  "EveResponseGroup",
  "EveStoredFile",
  "EveSubagentSession",
  "EveUsage",
  "EveWorkflowBackend",
  "EveVote",
  "McpConnector",
  "McpOAuthSession",
  "Project",
  "session",
  "user",
  "UserCredit",
  "UserModelPreference",
  "verification",
  "Chat",
  "Document",
  "GenerationCancellation",
  "Message",
  "Part",
  "Suggestion",
  "Vote",
] as const;
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/group-exports (#523): getMigrationHistoryProblem stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getMigrationHistoryProblem API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): getMigrationHistoryProblem uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): getMigrationHistoryProblem derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): getMigrationHistoryProblem handles optional available[index]?.hash; available[index]?.createdAt without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): getMigrationHistoryProblem accepts { applied, available, hasChatJsTables, }: { applied: MigrationIdentity[]; available: ; recorded; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): getMigrationHistoryProblem preserves explicit null in its storage/API state; undefined has different serialization and presence semantics.
 */
export const getMigrationHistoryProblem = ({
  applied,
  available,
  hasChatJsTables,
}: {
  applied: MigrationIdentity[];
  available: MigrationIdentity[];
  hasChatJsTables: boolean;
}): string | null => {
  if (applied.length === 0) {
    return hasChatJsTables
      ? "This database contains ChatJS tables but no EVE baseline migration record."
      : null;
  }

  if (applied.length > available.length) {
    return "This database contains migrations that are unknown to this ChatJS revision.";
  }

  const matchesAvailablePrefix = applied.every(
    (recorded, index) =>
      recorded.hash === available[index]?.hash &&
      recorded.createdAt === available[index]?.createdAt
  );
  return matchesAvailablePrefix
    ? null
    : "This database uses a migration history from before the EVE-only baseline.";
};
/* oxlint-enable import/group-exports, import/no-named-export, no-magic-numbers, no-ternary, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, unicorn/no-null */
