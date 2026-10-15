import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

interface MigrationIdentity {
  readonly createdAt: number;
  readonly hash: string;
}

/** Tables from the EVE-only baseline plus every retired ChatJS table. */
const KNOWN_CHATJS_TABLE_NAMES = [
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
  "EveSubmission",
  "EveMessageAnnotation",
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

const NO_RECORDED_MIGRATIONS = 0;

const getMigrationHistoryProblem = ({
  applied,
  available,
  hasChatJsTables,
}: ReadonlyNativeSurface<{
  readonly applied: MigrationIdentity[];
  readonly available: MigrationIdentity[];
  readonly hasChatJsTables: boolean;
}>): string | null => {
  if (applied.length === NO_RECORDED_MIGRATIONS) {
    if (hasChatJsTables) {
      return "This database contains ChatJS tables but no EVE baseline migration record.";
    }
    return null;
  }

  if (applied.length > available.length) {
    return "This database contains migrations that are unknown to this ChatJS revision.";
  }

  const matchesAvailablePrefix = applied.every(
    (recorded: MigrationIdentity, index) =>
      recorded.hash === available[index]?.hash &&
      recorded.createdAt === available[index]?.createdAt
  );

  if (matchesAvailablePrefix) {
    return null;
  }
  return "This database uses a migration history from before the EVE-only baseline.";
};
export { getMigrationHistoryProblem, KNOWN_CHATJS_TABLE_NAMES };
export type { MigrationIdentity };
