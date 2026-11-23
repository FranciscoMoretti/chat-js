"use client";

import React from "react";
import { signInEnding } from "eve/events";
import type {
  Interaction,
  InteractionOutcome,
  InteractionRequest,
  Answer,
} from "eve/events";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
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
  readonly request: InteractionRequest & { readonly interactionId: string };
  readonly disabled: boolean;
  readonly respond: (response: Answer) => void;
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
        respond({
          interactionId: request.interactionId,
          optionId: choice.value,
        });
        return;
      }
      const answer = new FormData(form).get("answer");
      if (
        request.allowFreeform === true &&
        typeof answer === "string" &&
        answer.trim()
      ) {
        respond({ interactionId: request.interactionId, text: answer.trim() });
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

const PendingSignIn = ({
  request,
  disabled,
}: PendingInputProps): React.JSX.Element => {
  const { signIn } = request;
  const name = signIn?.displayName ?? signIn?.name ?? "account";
  const url = signIn?.url;
  const safeUrl =
    url !== undefined && URL.canParse(url) && new URL(url).protocol === "https:"
      ? url
      : undefined;
  return (
    <Item
      variant="outline"
      size="sm"
      className="flex-col items-start sm:flex-row sm:items-center"
    >
      <ItemContent>
        <ItemTitle>{request.prompt}</ItemTitle>
        {signIn?.instructions !== undefined && signIn.instructions !== "" && (
          <p className="text-muted-foreground text-sm">{signIn.instructions}</p>
        )}
        {!disabled &&
          signIn?.userCode !== undefined &&
          signIn.userCode !== "" && (
            <p className="font-mono text-sm">{signIn.userCode}</p>
          )}
        <p className="text-muted-foreground text-sm">
          {safeUrl === undefined
            ? "Follow the sign-in instructions, or send a new message to request another link."
            : "Complete sign-in in the opened page. This conversation will continue automatically."}
        </p>
      </ItemContent>
      <ItemActions>
        {safeUrl !== undefined && !disabled ? (
          <a
            className={buttonVariants()}
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Connect {name}
          </a>
        ) : (
          <Button disabled>Sign-in unavailable</Button>
        )}
      </ItemActions>
    </Item>
  );
};

const PendingInput = (props: PendingInputProps): React.JSX.Element => {
  const { request, disabled, respond } = props;
  if (request.kind === "sign-in") {
    return <PendingSignIn {...props} />;
  }
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
                respond({
                  interactionId: request.interactionId,
                  optionId: option.id,
                });
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

const outcomeLabels = {
  accepted: "Answered",
  declined: "Declined",
  invalid: "Invalid response",
  failed: "Failed",
  expired: "Timed out",
  abandoned: "Cancelled",
  interrupted: "Cancelled",
  withdrawn: "Cancelled",
} satisfies Record<InteractionOutcome, string>;

const interactionResult = (interaction: Interaction): string => {
  if (interaction.status === "open") {
    return "Response submitted";
  }

  if (
    interaction.outcome === "accepted" &&
    interaction.request.kind === "approval"
  ) {
    return "Approved";
  }
  return outcomeLabels[interaction.outcome ?? "withdrawn"];
};

export const EveInteraction = ({
  interaction,
  disabled,
  respond,
}: {
  readonly interaction: Interaction;
  readonly disabled: boolean;
  readonly respond: (response: Answer) => void;
}): React.JSX.Element => {
  const { answer, interactionId, outcome, request, status } = interaction;
  if (status === "open" && answer === undefined) {
    return (
      <PendingInput
        request={{ ...request, interactionId }}
        disabled={disabled}
        respond={respond}
      />
    );
  }

  const answerLabel =
    answer?.text ??
    request.options?.find((option) => option.id === answer?.optionId)?.label ??
    answer?.optionId;
  const service =
    request.signIn?.displayName ?? request.signIn?.name ?? "Account";
  const result =
    request.kind === "sign-in" && status === "settled"
      ? `${service}${outcome === "accepted" ? "" : " authorization"} ${signInEnding(outcome ?? "withdrawn")}.`
      : interactionResult(interaction);

  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{request.prompt}</ItemTitle>
        {answerLabel !== undefined && (
          <p className="text-sm break-words whitespace-pre-wrap">
            {answerLabel}
          </p>
        )}
        <ItemDescription>{result}</ItemDescription>
      </ItemContent>
    </Item>
  );
};
