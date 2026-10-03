"use client";

import React, { useState } from "react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- LintControlsVisualFixture: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const LintControlsVisualFixture = () => {
  const [actions, setActions] = useState(0);
  const [inline, setInline] = useState(true);

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
          <InputGroupButton onClick={() => setActions((count) => count + 1)}>
            Attachment action
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      <p>Actions: {actions}</p>
      <div className="flex items-center gap-2">
        <Spinner aria-label="Saving" />
        <Shimmer as={inline ? "span" : "p"}>Thinking...</Shimmer>
      </div>
      <Button onClick={() => setInline((value) => !value)} type="button">
        Change shimmer element
      </Button>
    </main>
  );
};
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
