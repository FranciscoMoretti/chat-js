---
name: strategic-testing
description: Decide whether a change warrants new tests and choose proportionate verification. Use before adding tests, when planning validation, or when reviewing whether a proposed test protects meaningful behavior.
---

# Strategic testing

Add tests only when they protect meaningful behavior or a stable contract that
existing checks could realistically miss.

- Prioritize domain invariants, important edge cases, public interfaces,
  persisted data, security boundaries, and integration seams.
- Skip tests for mechanical edits, implementation details, existing coverage,
  or changes already verified by types, linting, or schema validation.
- Choose the smallest test level that protects the behavior.

Before adding a test, identify the realistic failure it prevents and confirm
that the maintenance cost is justified. If that case is weak, do not add one.
