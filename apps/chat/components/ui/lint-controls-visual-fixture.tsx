"use client";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import type { JSX as ReactJSX } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Spinner } from "@/components/ui/spinner";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (LintControlsVisualFixture); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- LintControlsVisualFixture renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable react/jsx-max-depth -- Keep the accessible composer hierarchy together for captures. */

const INITIAL_ACTION_COUNT = 0;
const ACTION_INCREMENT = 1;

export const LintControlsVisualFixture = (): ReactJSX.Element => {
  const [actions, setActions] = useState(INITIAL_ACTION_COUNT);
  const [inline, setInline] = useState(true);
  const incrementActions = useCallback(() => {
    setActions((count) => count + ACTION_INCREMENT);
  }, []);
  const changeShimmerElement = useCallback(() => {
    setInline((value) => !value);
  }, []);

  return (
    <main
      className="flex max-w-xl flex-col gap-6 p-8"
      data-testid="lint-controls-fixture"
    >
      <h1 className="text-lg font-semibold">Composer controls</h1>
      <InputGroup>
        <InputGroupTextarea
          aria-label="Message"
          placeholder="Write a message"
        />
        <InputGroupAddon align="block-end">
          <span>Focus message</span>
          <InputGroupButton onClick={incrementActions}>
            Attachment action
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p>Actions: {actions}</p>
      <div className="flex items-center gap-2">
        <Spinner aria-label="Saving" />
        <Shimmer
          as={
            // oxlint-disable-next-line no-ternary -- Keep as JSX attribute as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
            inline ? "span" : "p"
          }
        >
          Thinking...
        </Shimmer>
      </div>
      <Button onClick={changeShimmerElement} type="button">
        Change shimmer element
      </Button>
    </main>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */
