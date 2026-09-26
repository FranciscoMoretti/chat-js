# Conversation search

The search dialog waits 250 ms after typing pauses and cancels superseded requests immediately. Skeletons replace results while the current query runs, so previous-query or stale cached matches are not presented for new input. Empty input shows recent chats. Searches return one result per logical chat, ordered by relevance and then recent activity. Selecting a result opens the matching branch.

Search uses PostgreSQL full-text indexes over titles and visible user/assistant message text. Title matches receive a ranking boost while matching message text supplies the excerpt and destination branch when available. Pages continue using rank, full-precision activity time, and chat ID rather than offsets. Results are live, so changes to a conversation after a page is loaded can still move that conversation across the cursor. The `simple` dictionary preserves words across languages without applying English stemming; matching is case-insensitive and token-based. The final unquoted positive word matches prefixes (for example, `friend` matches `friendly`, and `ocean poe` matches `ocean poem`). Earlier words remain whole-word matches. Quoted phrases and `OR` use PostgreSQL's web-search query syntax. This does not provide typo correction, semantic matching, or arbitrary substring matching.

`EveSearchText` is a rebuildable projection, not a transcript store. EVE remains the source of truth. Event hooks index received user text and completed assistant text; inherited history is buffered until its branch is bound. Saved copies index their seed in the binding transaction. Reasoning, tool payloads, attachments, and background-task inputs are excluded. Long text is divided into overlapping bounded chunks, so all query terms must match within one chunk or the title.

Search requires the authenticated owner on both the chat and branch. Deleting branches are immediately excluded; completed conversation deletion erases the projection. Writers lock and recheck the binding, preventing a concurrent backfill from restoring deleted text. Replaying events is idempotent. Search-hook failures are logged without rejecting chat turns; pending text is retained for the next eligible event, capped at 256 entries and 256,000 characters per session. Duplicate event keys are ignored. Overflow marks the session for automatic snapshot recovery after binding, including the next live message, so a healthy database does not require operator intervention for large restored histories. Recovery failures keep the flag for the next eligible event. Logs identify the session and omitted count with `search:backfill` as a manual fallback; EVE remains the durable source for all omitted text.

## Deploy and backfill

1. Run `bun db:migrate` before deploying the new EVE hooks and search endpoint. The search table migration follows the attachment migrations from main. The runner builds the existing chat title index concurrently after the migration transaction so chat writes remain available; rerunning repairs an interrupted concurrent build.
2. Deploy both the app and EVE runtime so new events are indexed.
3. For local development, run `bun search:backfill` from the repository root; it loads the worktree environment. For a deployed environment, export its database and EVE configuration and run `bun run --cwd apps/chat search:backfill` directly, without the local worktree wrapper. The command reads snapshots sequentially, reports counts without transcript text, and exits unsuccessfully if any snapshot fails. Rerun it to retry; existing rows are not duplicated.

Existing titles remain searchable before backfill completes. Old message content becomes searchable as each branch is indexed. The same backfill command repairs missed event deliveries and refreshes existing chunks when their overlap changes; unchanged chunks remain untouched. EVE sessions pinned to an older runtime generation may require a subsequent backfill until they use the new hook generation.

## Verification

The database tests apply the real migrations in embedded PostgreSQL and check content matching, title ranking, owner isolation, replay idempotency, and deletion. Playwright covers one request per typing burst, skeletons during a delayed response, suppressed cancellation errors, keyboard branch navigation, and a gallery of search states.

## Databases from the unreleased search preview

The initial PR commit `a84b363c` used `0002_opposite_firelord`. It was never part of main: main already owns migration slots 2 and 3 for attachments, and the final search migration is slot 4. Normal main-to-PR upgrades retain all existing migration identities.

A development database that applied that initial preview needs a one-time repair. Do **not** provision an empty database or discard transcripts just to resolve this preview-history mismatch. Stop its app/EVE writers and back up the database. Run `apps/chat/scripts/repair-search-preview.sql` with `psql -v ON_ERROR_STOP=1` against that development database using its migration connection. The script locks and validates the exact three timestamp/hash pairs from the initial preview, rejects every other history, and transactionally removes only the rebuildable `EveSearchText` projection and its unpublished migration record. It leaves chats, EVE session identities, attachments, and transcripts intact.

Then run `bun db:migrate`, deploy the current app/EVE runtime, and run `bun search:backfill` to reconstruct the index. This is an explicit development-preview recovery step, not an automatic rewrite of production migration history.
