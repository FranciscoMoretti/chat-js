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
import { Spinner } from "@/components/ui/spinner";

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

  const Thinking = inline ? "span" : "p";

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
        <Thinking className="shimmer text-muted-foreground motion-reduce:shimmer-none">Thinking...</Thinking>
      </div>
      <Button onClick={changeShimmerElement} type="button">
        Change shimmer element
      </Button>
    </main>
  );
};
