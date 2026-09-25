# Conversation search

The search dialog waits 250 ms after typing pauses and cancels superseded requests immediately. Skeletons replace results while the current query runs, so previous-query or stale cached matches are not presented for new input. Empty input shows recent chats. Searches return one result per logical chat, ordered by relevance and then recent activity. Selecting a result opens the matching branch.

Search uses PostgreSQL full-text indexes over titles and visible user/assistant message text. Title matches receive a ranking boost while matching message text supplies the excerpt and destination branch when available. Pages continue using rank, full-precision activity time, and chat ID rather than offsets. Results are live, so changes to a conversation after a page is loaded can still move that conversation across the cursor. The `simple` dictionary preserves words across languages without applying English stemming; matching is case-insensitive and token-based. The final unquoted positive word matches prefixes (for example, `friend` matches `friendly`, and `ocean poe` matches `ocean poem`). Earlier words remain whole-word matches. Quoted phrases and `OR` use PostgreSQL's web-search query syntax. This does not provide typo correction, semantic matching, or arbitrary substring matching.

`EveSearchText` is a rebuildable projection, not a transcript store. EVE remains the source of truth. Event hooks index received user text and completed assistant text; inherited history is buffered until its branch is bound. Saved copies index their seed in the binding transaction. Reasoning, tool payloads, attachments, and background-task inputs are excluded. Long text is divided into overlapping bounded chunks, so all query terms must match within one chunk or the title.

Search requires the authenticated owner on both the chat and branch. Deleting branches are immediately excluded; completed conversation deletion erases the projection. Writers lock and recheck the binding, preventing a concurrent backfill from restoring deleted text. Replaying events is idempotent. Search-hook failures are logged without rejecting chat turns; pending text is retained for the next eligible event and can also be recovered by backfill.

## Deploy and backfill

1. Run `bun db:migrate` before deploying the new EVE hooks and search endpoint. The search table migration follows the attachment migrations from main. The runner builds the existing chat title index concurrently after the migration transaction so chat writes remain available; rerunning repairs an interrupted concurrent build.
2. Deploy both the app and EVE runtime so new events are indexed.
3. For local development, run `bun search:backfill` from the repository root; it loads the worktree environment. For a deployed environment, export its database and EVE configuration and run `bun run --cwd apps/chat search:backfill` directly, without the local worktree wrapper. The command reads snapshots sequentially, reports counts without transcript text, and exits unsuccessfully if any snapshot fails. Rerun it to retry; existing rows are not duplicated.

Existing titles remain searchable before backfill completes. Old message content becomes searchable as each branch is indexed. The same backfill command repairs missed event deliveries. EVE sessions pinned to an older runtime generation may require a subsequent backfill until they use the new hook generation.

## Verification

The database tests apply the real migrations in embedded PostgreSQL and check content matching, title ranking, owner isolation, replay idempotency, and deletion. Playwright covers one request per typing burst, skeletons during a delayed response, suppressed cancellation errors, keyboard branch navigation, and a gallery of search states.
