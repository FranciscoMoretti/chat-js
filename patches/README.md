# Maintained dependency patches

EVE is installed from the published `@chat-js/eve` fork through the `eve` npm alias. Its source and packaging workflow live in [the fork](https://github.com/FranciscoMoretti/eve/tree/francisco/chatjs-package); see [the package development guide](../docs/eve-package-development.md). The former EVE source/compiled patches and assembler were removed after publication. Git retains them at `cd89d3c7`.

## Active patches

- `ai-sdk-mcp@2.0.52.patch`: single-flight SSE authorization refresh and late-401 handling. Rebased from 2.0.45 by applying with Git and regenerating the diff against the new package. Correct hunk offsets matter for Bun. SDK versions across ChatJS, gateways, registry, thread, telemetry, and React are aligned with `ai@7.0.105`.
- `workflow-world-postgres@5.0.0-beta.40.patch`: unchanged stream-transfer patch. This upgrade does not change the app's Postgres world package or migrate a database.
