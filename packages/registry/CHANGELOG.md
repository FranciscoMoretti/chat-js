# @chat-js/registry

## 1.0.0

### Major Changes

- [#346](https://github.com/FranciscoMoretti/chat-js/pull/346) [`2962417`](https://github.com/FranciscoMoretti/chat-js/commit/296241729e7235be9e91149f37f79b7dfb678fb7) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Build standard registry JSON from tested TypeScript sources using shadcn. Use shadcn for gateway/tool installation and generate typed registrations from local tool descriptors. Add `chat-js sync` and separate custom registration modules.

  Registry v1 publishes `dist/r/`; historical v0 npm artifacts keep their legacy format. Publish registry v1 and gateway contracts before promoting the CLI. Remove `--registry`, `--no-install`, `--package-manager`, and `paths.tools` in favor of standard namespaces, immediate installation, package-manager detection, and explicit registry targets. Known legacy built-in registrations migrate on sync.

### Minor Changes

- [#332](https://github.com/FranciscoMoretti/chat-js/pull/332) [`5b6664e`](https://github.com/FranciscoMoretti/chat-js/commit/5b6664e7b846851228605933160281b07a4b0ce2) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select AI gateways during ChatJS creation through shadcn-format registry items, including external registry URLs. Install only the selected adapter source and its declared dependencies. Keep shared contracts and runtime utilities in @chat-js/gateways, and validate configuration against the installed adapter.

- [#358](https://github.com/FranciscoMoretti/chat-js/pull/358) [`5d55983`](https://github.com/FranciscoMoretti/chat-js/commit/5d5598361cf3bed3e7df5a2efa2b467e0dc9a54e) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Extract Tavily and Firecrawl search into selectable registry tools shared by chat and deep research. Add the webSearch factory slot, selected credential requirements, and the --search-tool create option.

- [#360](https://github.com/FranciscoMoretti/chat-js/pull/360) [`62cdaf2`](https://github.com/FranciscoMoretti/chat-js/commit/62cdaf2316cbfa1a8e5100e41d88513671962c5c) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Distribute Vercel code execution as a source registry item. Let code-execution and search selections export standard AI SDK tools with their own schemas and optional renderers. Install only the selected implementations in new apps and pass request services through AI SDK tool context.

- [#362](https://github.com/FranciscoMoretti/chat-js/pull/362) [`d1e1eb8`](https://github.com/FranciscoMoretti/chat-js/commit/d1e1eb89245145d3afd7cba4ec37f35ce9dfa838) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select image generation from built-in or external registry items. Fresh apps install only the selected image tool and renderer, with request services supplied through AI SDK context.

- [#361](https://github.com/FranciscoMoretti/chat-js/pull/361) [`10e1996`](https://github.com/FranciscoMoretti/chat-js/commit/10e1996a72c64619a00ec5482d67c9a9c05dda62) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Select URL retrieval tools during creation using the retrieveUrl slot. Install only the selected provider and derive its credential requirements from registry metadata.

- [#363](https://github.com/FranciscoMoretti/chat-js/pull/363) [`0a8ca04`](https://github.com/FranciscoMoretti/chat-js/commit/0a8ca041baabe045e17a351b4e8836c3c2850a2c) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Install video generation as a selectable registry tool with optional renderer, provider credentials, and request context. Omit the built-in implementation from unselected apps.

- [#350](https://github.com/FranciscoMoretti/chat-js/pull/350) [`5691d2a`](https://github.com/FranciscoMoretti/chat-js/commit/5691d2aa1e3ea1866e991db6678f186ca8acfaaa) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Install storage adapters through shadcn registry items. Support external storage items during app creation, generate typed provider options, and validate declared environment requirements without requiring a built-in Files SDK provider name.

## 0.1.2

### Patch Changes

- [#180](https://github.com/FranciscoMoretti/chat-js/pull/180) [`eee3cdc`](https://github.com/FranciscoMoretti/chat-js/commit/eee3cdcf32c89129d895774cfed420914c058214) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Unify package releases around Changesets by removing the dedicated registry deploy workflow and switching the CLI's default registry source to the published `@chat-js/registry` package on npm.

## 0.1.1

### Patch Changes

- [#159](https://github.com/FranciscoMoretti/chat-js/pull/159) [`a507edd`](https://github.com/FranciscoMoretti/chat-js/commit/a507edd5e6678cadc5b73937d3c5baac49af246e) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Publish `@chat-js/registry` as a public package and expose its generated registry artifacts plus shared tool env requirement types.

- Test patch release generation across all releasable packages.
