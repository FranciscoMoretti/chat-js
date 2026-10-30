# ChatJS installation files

This directory contains CLI-managed installation wiring and bookkeeping.

- `generated/`: generated imports and registrations. Do not edit. Run `chat-js sync` after changing installation descriptors.
- `installed-source.json`: hashes of files actually installed by the CLI. Keep this receipt in version control so local edits can be detected.
- `installed-dependencies.json`: package ownership recorded during installation. Keep it in version control.
- `retained-plugin-schemas.json`: schema inputs retained after plugin removal. Keep it in version control until you deliberately retire those schemas.
- `removed-plugins/` and `replaced-*`: source backups. Review before deleting. They are not active application source.

Run `chat-js status` to inspect plugin ownership and local edits, or `chat-js status --files` to include unchanged files. No registry requests or writes are performed.

## Files you can edit

- `integrations/`: app-owned chat lifecycle and billing composition. Add, remove, and sync preserve these files.
- `composition/custom/`: app-owned tool composition. Sync preserves these files.
- `plugins/<id>/`: editable installed source. Its `chatjs.json` descriptor records its identity, capabilities, and owned paths. Treat the descriptor as installation metadata; plugin authors can update it when they deliberately change the installation contract.
- Framework files such as `app/.../page.tsx` or `agent/hooks/...` may also belong to a plugin. Look for the ownership comment or inspect status before removing them.
- Ordinary app code is yours. Files listed in a plugin descriptor are the exception to the assumption that everything under `app/` is app-owned.

Modified and untracked source is protected during replacement/removal. `add --overwrite` explicitly authorizes replacement. `remove --backup` preserves customized removed source. Inspect `remove <id> --dry-run` first. Plugin source updates are not automatically merged.

Status compares against your recorded installation, not the newest upstream release. Tools, gateways, storage, and sandbox implementations are outside its plugin inventory.
