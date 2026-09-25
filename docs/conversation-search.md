# Conversation search

The search dialog waits 250 ms after typing pauses and cancels superseded requests immediately. Skeletons replace results while the current query runs, so previous-query or stale cached matches are not presented for new input. Empty input shows recent chats. Searches return one result per logical chat, ordered by relevance and then recent activity. Selecting a result opens the matching branch.

Search uses PostgreSQL full-text indexes over titles and visible user/assistant message text. Title matches receive a ranking boost. The `simple` dictionary preserves words across languages without applying English stemming; matching is case-insensitive and token-based. The final unquoted positive word matches prefixes (for example, `friend` matches `friendly`, and `ocean poe` matches `ocean poem`). Earlier words remain whole-word matches. Quoted phrases and `OR` use PostgreSQL's web-search query syntax. This does not provide typo correction, semantic matching, or arbitrary substring matching.

`EveSearchText` is a rebuildable projection, not a transcript store. EVE remains the source of truth. Event hooks index received user text and completed assistant text; inherited history is buffered until its branch is bound. Saved copies index their seed in the binding transaction. Reasoning, tool payloads, attachments, and background-task inputs are excluded. Long text is divided into overlapping bounded chunks, so all query terms must match within one chunk or the title.

Search requires the authenticated owner on both the chat and branch. Deleting branches are immediately excluded; completed conversation deletion erases the projection. Writers lock and recheck the binding, preventing a concurrent backfill from restoring deleted text. Replaying events is idempotent.

## Deploy and backfill

1. Apply the generated database migration before deploying the new EVE hooks and search endpoint.
2. Deploy both the app and EVE runtime so new events are indexed.
3. For local development, run `bun search:backfill` from the repository root; it loads the worktree environment. For a deployed environment, export its database and EVE configuration and run `bun run --cwd apps/chat search:backfill` directly, without the local worktree wrapper. The command reads snapshots sequentially, reports counts without transcript text, and exits unsuccessfully if any snapshot fails. Rerun it to retry; existing rows are not duplicated.

Existing titles remain searchable before backfill completes. Old message content becomes searchable as each branch is indexed. The same backfill command repairs missed event deliveries. EVE sessions pinned to an older runtime generation may require a subsequent backfill until they use the new hook generation.

## Verification

The database tests apply the real migrations in embedded PostgreSQL and check content matching, title ranking, owner isolation, replay idempotency, and deletion. Playwright covers one request per typing burst, skeletons during a delayed response, suppressed cancellation errors, keyboard branch navigation, and a gallery of search states.
