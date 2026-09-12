---
name: making-ui-changes
description: Read before changing any component, page, or styles. Five moves to change UI without silently breaking another screen - reuse before you create, cover every state, check the blast radius, prove it with a visual test, kill flake at the source.
---

# Making UI changes

Run these five moves on any UI change.

## 1. Reuse before you create

Search for an existing component and extend it (`variant="danger"`, a new prop) instead of adding a near-copy. Two components that look the same drift apart. Build net-new only when nothing fits - then it goes through move 2.

## 2. Cover every state, in the same change

Every component or state you add or change owes a story/capture in the _same_ change, never a follow-up. Don't hand-write one per combination - generate them densely (`economical-visual-tests`). No visual testing wired yet? `setup-visual-testing` first.

## 3. Check the blast radius

Editing a shared component changes every screen that imports it. Grep the importers, decide which ones this touches, and make sure each has a story/capture so the diff will catch it.

## 4. Prove it with a visual test

Not done until you've looked at what moved: `check-visual-changes` mid-edit, or the PR check + `triage-visual-changes`. A story that changed which your diff shouldn't touch is a stop-and-look (usually move 3), not an accept.

## 5. Kill flake at the source

A story that comes back changed with no real change (clock, live data, animation, randomness) is flake. Fix it at capture time (`storybook-`/`playwright-`/`vitest-visual-testing`) - don't accept it, don't disable the check.

## Wire it in

Add to AGENTS.md and CLAUDE.md so this runs on every UI change (`setup-visual-testing` does this for you):

> Before changing any component, page, or styles, read making-ui-changes: reuse before you create, add or update the story/capture in the same change, check the blast radius, and prove it with a visual test.
