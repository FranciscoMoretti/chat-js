// oxlint-disable-next-line eslint/require-await -- Native creation accepts a Promise-returning allocator; a fresh UUID must be generated on each invocation, not when the fixture is defined.
export const createEveTestSession = async (): Promise<string> =>
  crypto.randomUUID();
