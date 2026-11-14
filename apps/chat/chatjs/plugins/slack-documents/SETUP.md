# Optional ChatJS documents in Slack

This plugin adds ChatJS-owned document storage and workspace/conversation isolation. It is not required for a native EVE Slack agent and does not replace Slack's authentication or channel behavior.

Configure `CHATJS_SLACK_DOCUMENTS` with `workspaces`, each containing `teamId`, `userIds`, `channelIds`, and optionally `directMessages`. Apply the application's database migrations to create the resource tables. The resource policy is checked only when a document operation executes. Users outside that policy may still use ordinary EVE capabilities, but cannot read or modify ChatJS documents.

For document delivery, add `slackDocumentsRenderer` from `@/chatjs/plugins/slack-documents/slack-documents-renderer` to the `renderers` option of your native `slackChannel` definition. Credentials and installation setup remain EVE's responsibility.

Document operations resolve EVE's authenticated current caller, reserve the application resource scope on first access, and recheck every operation. All lookups are scoped by workspace and conversation. Collaborators share documents within that conversation; private web files and documents remain separate. No web-account link or billing policy is required.

Conflicting native channel/timestamp addresses are rejected by the application resource binding. This does not fix EVE's native multiworkspace routing; follow the compatibility gate in the native Slack setup document before enabling multiple installations. Live Slack checks remain pending.
