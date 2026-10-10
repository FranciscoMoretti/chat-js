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

/* oxlint-disable unicorn/no-null --
unicorn/no-null (#570): getMigrationHistoryProblem preserves explicit null in its storage/API state; undefined has different serialization and presence semantics. */
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
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading hash from available[index]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      recorded.hash === available[index]?.hash &&
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading createdAt from available[index]; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      recorded.createdAt === available[index]?.createdAt
  );

  if (matchesAvailablePrefix) {
    return null;
  }
  return "This database uses a migration history from before the EVE-only baseline.";
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getMigrationHistoryProblem, KNOWN_CHATJS_TABLE_NAMES); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable unicorn/no-null */
export { getMigrationHistoryProblem, KNOWN_CHATJS_TABLE_NAMES };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (MigrationIdentity); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { MigrationIdentity };
/* oxlint-enable import/no-named-export */
