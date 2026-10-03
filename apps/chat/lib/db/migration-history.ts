export interface MigrationIdentity {
  createdAt: number;
  hash: string;
}

/* oxlint-disable import/group-exports --
 * import/group-exports (#523): KNOWN_CHATJS_TABLE_NAMES stays exported at its declaration so its public contract is visible beside its implementation.
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
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * import/group-exports (#523): getMigrationHistoryProblem stays exported at its declaration so its public contract is visible beside its implementation.
 * no-magic-numbers (#517): getMigrationHistoryProblem uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
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
/* oxlint-enable import/group-exports, no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
