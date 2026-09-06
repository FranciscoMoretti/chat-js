#!/usr/bin/env bash
set -euo pipefail
# Research fixture resolves the existing app test dependencies without adding
# production or workspace dependencies. No network or database required.
if [[ ! -e research/319/node_modules ]]; then
  ln -s ../../apps/chat/node_modules research/319/node_modules
fi
bun apps/chat/node_modules/vitest/vitest.mjs run --config research/319/vitest.config.ts
