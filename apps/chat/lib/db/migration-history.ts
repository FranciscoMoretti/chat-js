export interface MigrationIdentity {
  createdAt: number;
  hash: string;
}

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
  "EveUsage",
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
