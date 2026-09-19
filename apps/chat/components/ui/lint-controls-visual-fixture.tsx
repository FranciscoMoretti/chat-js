"use client";

import { useState } from "react";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

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
