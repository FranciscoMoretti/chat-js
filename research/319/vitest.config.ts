import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
export default defineConfig({
 resolve: { alias: {
  '@': resolve(import.meta.dirname, '../../apps/chat'),
  'react-test-renderer': resolve(import.meta.dirname, '../../packages/thread/node_modules/react-test-renderer'),
 } },
 test: { include: ['research/319/*.test.jsx'] },
});
