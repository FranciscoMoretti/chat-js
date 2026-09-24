# Documentation release policy

## During the EVE preview

Public documentation remains on the pre-EVE release. The Vercel `chat-js-docs` project tracks `francisco/docs-stable-pre-eve` for production, created at `4584f093835f1667c010c8fc20c502fa3f2bde41`, the production docs commit at the time of the split.

The website forwards `/docs` to `chat-js-docs.vercel.app`, so this tracking setting preserves the public documentation when the EVE stack merges into main. Other Vercel projects keep their existing production branches. Do not manually promote an EVE docs preview to production during this period.

Keep EVE docs on preview deployments until the default published CLI generates the EVE application. Critical stable-doc fixes belong on the stable branch. Do not merge the EVE stack into that branch. There is no public beta selector during this phase.

## When EVE becomes the default release

1. Verify the published CLI's default install generates the EVE app and follow its quickstart against that package.
2. Use Blume's built-in `blume version <id>` workflow on the stable content to create a frozen archive. Choose the ID and label from the actual previous release, rather than assuming a 1.0 release number. Bring that archive and the generated version configuration into the EVE docs. Do not snapshot the EVE content as the old version.
3. Keep EVE docs at the content root. Configure the current label and archived label using Blume's native `versions` support. Verify same-page switching, fallback navigation, internal links, assets, and version-scoped search in a preview.
4. Change only the `chat-js-docs` production branch back to `main` and deploy the verified docs commit. Check both `chatjs.dev/docs` and the docs project's production aliases.
5. Retain the stable branch as the source of the archived release until the archive has been verified. Maintain the old docs only for critical corrections.

Blume 1.6.3 already includes snapshots and a version selector. No custom version-routing system is needed.
