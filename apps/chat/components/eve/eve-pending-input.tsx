"use client";

import React from "react";
import type { EveMessageInputRequest, InputResponse } from "eve/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemTitle,
} from "@/components/ui/item";
import {
  Questionnaire,
  QuestionnaireActions,
  QuestionnaireChoice,
  QuestionnaireChoiceDescription,
  QuestionnaireChoices,
  QuestionnaireError,
  QuestionnaireInput,
  QuestionnaireItem,
  QuestionnaireSubmit,
  QuestionnaireTitle,
} from "@/components/ui/questionnaire";

interface PendingInputProps {
  readonly request: EveMessageInputRequest;
  readonly disabled: boolean;
  readonly respond: (response: InputResponse) => void;
}

const PendingQuestion = ({
  request,
  disabled,
  respond,
}: PendingInputProps): React.JSX.Element => (
  <Questionnaire
    items={[
      {
        name: "answer",
        required: true,
        choices: request.options?.map((option) => ({ value: option.id })),
      },
    ]}
    onSubmit={(event) => {
      event.preventDefault();
      if (disabled) {
        return;
      }
      const form = event.currentTarget;
      const choice = form.querySelector<HTMLInputElement>(
        'input[type="radio"]:checked'
      );
      if (
        choice &&
        request.options?.some((option) => option.id === choice.value) === true
      ) {
        respond({ requestId: request.requestId, optionId: choice.value });
        return;
      }
      const answer = new FormData(form).get("answer");
      if (
        request.allowFreeform === true &&
        typeof answer === "string" &&
        answer.trim()
      ) {
        respond({ requestId: request.requestId, text: answer.trim() });
      }
    }}
  >
    <QuestionnaireItem name="answer" required disabled={disabled}>
      <QuestionnaireTitle>{request.prompt}</QuestionnaireTitle>
      <QuestionnaireChoices>
        {request.options?.map((option) => (
          <QuestionnaireChoice key={option.id} value={option.id}>
            {option.label}
            {option.description !== undefined && option.description !== "" && (
              <QuestionnaireChoiceDescription>
                {option.description}
              </QuestionnaireChoiceDescription>
            )}
          </QuestionnaireChoice>
        ))}
        {request.allowFreeform === true && (
          <QuestionnaireInput
            aria-label="Your answer"
            className="h-auto min-h-20 resize-y"
            placeholder="Write your answer…"
            maxLength={16_000}
            render={
              <Textarea
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.stopPropagation();
                  }
                }}
              />
            }
          />
        )}
      </QuestionnaireChoices>
      <QuestionnaireError />
    </QuestionnaireItem>
    <QuestionnaireActions>
      <QuestionnaireSubmit disabled={disabled}>
        Submit answer
      </QuestionnaireSubmit>
    </QuestionnaireActions>
  </Questionnaire>
);

export const EvePendingInput = (
  props: PendingInputProps
): React.JSX.Element => {
  const { request, disabled, respond } = props;
  if (request.kind === "question" && request.display !== "confirmation") {
    return <PendingQuestion {...props} />;
  }
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{request.prompt}</ItemTitle>
      </ItemContent>
      <ItemActions className="flex-wrap">
        {request.options?.map((option) => (
          <Button
            key={option.id}
            disabled={disabled}
            title={option.description}
            variant={option.style === "danger" ? "destructive" : "outline"}
            onClick={() => {
              if (!disabled) {
                respond({ requestId: request.requestId, optionId: option.id });
              }
            }}
            type="button"
          >
            {option.label}
          </Button>
        ))}
      </ItemActions>
      {request.allowFreeform === true && (
        <PendingQuestion
          {...props}
          request={{ ...request, options: [], prompt: "Or write an answer" }}
        />
      )}
    </Item>
  );
};
