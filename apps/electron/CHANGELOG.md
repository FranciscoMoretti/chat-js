# @chat-js/electron

## 0.3.3

### Patch Changes

- [#906](https://github.com/FranciscoMoretti/chat-js/pull/906) [`95bfbcb`](https://github.com/FranciscoMoretti/chat-js/commit/95bfbcb3ef01c7d03a0b79a545e9fb425c4ed7c6) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Extract Desktop into an optional registry plugin with authentication, navigation, and session synchronization contributions. Install the web integration and Electron companion together through create or add desktop, keep web-only apps free of desktop code and dependencies, and generate the companion's runtime configuration during prebuild.

## 0.3.2

### Patch Changes

- [#180](https://github.com/FranciscoMoretti/chat-js/pull/180) [`eee3cdc`](https://github.com/FranciscoMoretti/chat-js/commit/eee3cdcf32c89129d895774cfed420914c058214) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Unify package releases around Changesets by removing the dedicated registry deploy workflow and switching the CLI's default registry source to the published `@chat-js/registry` package on npm.

## 0.3.1

### Patch Changes

- Test patch release generation across all releasable packages.

## 0.3.0

### Minor Changes

- [#136](https://github.com/FranciscoMoretti/chat-js/pull/136) [`6b1458c`](https://github.com/FranciscoMoretti/chat-js/commit/6b1458cb071fe4e67bca99fa86ff55bfb4852c64) Thanks [@FranciscoMoretti](https://github.com/FranciscoMoretti)! - Add a Changesets-driven desktop release flow for the Electron app. Desktop artifacts are versioned through the shared version PR flow, then published to GitHub Releases for the ChatJS reference app.
