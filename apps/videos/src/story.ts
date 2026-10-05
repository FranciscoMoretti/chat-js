const FPS = 30;

const DURATION = 48;

type PathId = "city" | "food";

type ReplyState = "streaming" | "stopped" | "complete";

const script = {
  budget: {
    prompt: "Make it vegetarian.",
    reply: "Try vegetable petiscos, market salads, and a vegetarian tasca.",
    title: "Vegetarian",
  },
  city: {
    label: "City sights",
    text: "Saturday — Explore Alfama, then ride tram 28.\n\nSunday — Visit Belém and watch the sunset by the river.",
  },
  family: {
    prompt: "Make it kid-friendly.",
    reply: "Try the aquarium, a park picnic, and an ice cream stop.",
    title: "With the kids",
  },
  food: {
    label: "Food trip",
    text: "Saturday — Try the pastries and visit the food market.\n\nSunday — Find a local tasca for lunch, then share petiscos.",
  },
  package: "@chat-js/thread",
  porto: {
    label: "Porto",
    preservedNote: "Both Lisbon conversations kept",
    prompt: "Plan a weekend in Porto.",
    reply:
      "Saturday — Explore Ribeira and walk across the Dom Luís I Bridge.\n\nSunday — Visit the gardens, then catch the sunset by the river.",
    title: "Porto weekend",
  },
  prompt: "Plan a weekend in Lisbon.",
  title: "Lisbon weekend",
  url: "chatjs.dev/threads",
};

type LaunchScript = typeof script;

const beats = [
  {
    at: 0,
    subtitle: "Regenerate. Switch answers. Keep chatting.",
    title: "Branching conversations for AI SDK",
  },
  {
    at: 48.5,
    subtitle: "An npm package for your AI SDK app.",
    title: "Add branching to your chat",
  },
];

/* oxlint-disable eslint/id-length -- clamp: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */
/* oxlint-disable eslint/no-magic-numbers -- clamp: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
const clamp = (x: number): number => Math.max(0, Math.min(1, x));
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */

/* oxlint-disable eslint/id-length -- ease: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */
/* oxlint-disable eslint/no-magic-numbers -- ease: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
const ease = (x: number): number => {
  const v = clamp(x);
  return v * v * (3 - 2 * v);
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */

/* oxlint-disable eslint/no-magic-numbers -- textAt: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
const textAt = (text: string, fraction: number): string =>
  text.slice(0, Math.floor(clamp(fraction) * text.length));
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-disable eslint/no-magic-numbers -- editTextAt: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- editTextAt: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const editTextAt = (timeSeconds: number, content: LaunchScript): string => {
  let prefixLength = 0;
  while (
    prefixLength < content.prompt.length &&
    prefixLength < content.porto.prompt.length &&
    content.prompt[prefixLength] === content.porto.prompt[prefixLength]
  ) {
    prefixLength += 1;
  }
  const editPrefix = content.porto.prompt.slice(0, prefixLength);
  const editSuffix = content.porto.prompt.slice(prefixLength);
  return timeSeconds < 42.6
    ? content.prompt
    : `${editPrefix}${textAt(editSuffix, (timeSeconds - 42.6) / 1.1)}`;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/no-magic-numbers -- noteAt: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
const noteAt = (timeSeconds: number): string => {
  let note = "";
  if (timeSeconds >= 22) {
    note = "Both paths are yours to keep.";
  } else if (timeSeconds >= 12 && timeSeconds < 18) {
    note = "One prompt. Two answers.";
  } else if (timeSeconds >= 19 && timeSeconds < 22) {
    note = "Your original is here. The other reply keeps going.";
  }
  return note;
};
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable eslint/max-statements -- stateAt: This ordered transaction/startup operation shares local validation and cleanup; extraction requires lifecycle boundaries. */
/* oxlint-disable typescript/explicit-module-boundary-types -- stateAt: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- stateAt: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/id-length -- stateAt: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */
/* oxlint-disable eslint/no-magic-numbers -- stateAt: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- stateAt: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const stateAt = (t: number, content: LaunchScript = script) => {
  let selected: PathId = "city";
  if (t >= 12.2 && t < 19) {
    selected = "food";
  }
  if (t >= 19 && t < 33) {
    selected = "city";
  }
  if (t >= 33) {
    selected = "food";
  }
  const editing = t >= 42.2 && t < 44.8;
  const edited = t >= 44.8;
  const following = t >= 24 && t < 41.5;
  const family = t >= 24 && t < 33;
  const budget = t >= 34;
  const followup = family ? content.family : content.budget;
  const progress = clamp((t - (family ? 24.6 : 34.6)) / 2.4);
  const texts = {
    city: textAt(content.city.text, (t - 3.5) / 3),
    food: textAt(content.food.text, (t - 12.2) / 10),
  };
  const states: Record<PathId, ReplyState> = {
    city: t < 6.5 ? "streaming" : "complete",
    food: t < 22.2 ? "streaming" : "complete",
  };
  return {
    answer: texts[selected],
    budget,
    editText: editTextAt(t, content),
    edited,
    editing,
    family,
    following: following && (family || budget),
    followup: {
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing followup own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...followup,
      state: progress < 1 ? ("streaming" as const) : ("complete" as const),
      text: textAt(followup.reply, progress),
    },
    foodVisible: t >= 12.2,
    note: noteAt(t),
    portoAnswer: textAt(content.porto.reply, (t - 45) / 2.5),
    portoState: t < 47.5 ? ("streaming" as const) : ("complete" as const),
    reveal: ease((t - 11.5) / 0.3),
    selected,
    states,
    texts,
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable eslint/max-statements */

type StoryState = ReturnType<typeof stateAt>;

const captionBeats = [
  { end: 11.5, label: "Try another answer", start: 10 },
  { end: 18, label: "Switch while replies stream", start: 16.5 },
  { end: 24, label: "Continue either conversation", start: 22.5 },
  { end: 32, label: "Continue the other", start: 30.5 },
  { end: 41.5, label: "Edit any message. Keep both versions.", start: 40 },
];

/* oxlint-disable typescript/explicit-module-boundary-types -- presentationAt: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- presentationAt: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/no-magic-numbers -- presentationAt: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
/* oxlint-disable unicorn/no-null -- presentationAt: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- presentationAt: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const presentationAt = (wallTime: number) => {
  // Cut only completed-reply holds; keep action and streaming speed unchanged.
  const time =
    wallTime +
    (wallTime >= 8 ? 2 : 0) +
    (wallTime >= 26.5 ? 2 : 0) +
    (wallTime >= 34.5 ? 1.5 : 0);
  const beat = captionBeats.find(
    (captionBeat): boolean =>
      time >= captionBeat.start && time < captionBeat.end
  );
  if (!beat) {
    return { caption: null, demoTime: time, opacity: 0 };
  }
  const elapsed = time - beat.start;
  const duration = beat.end - beat.start;
  return {
    caption: beat.label,
    demoTime: beat.start,
    opacity: Math.min(ease(elapsed / 0.15), ease((duration - elapsed) / 0.15)),
  };
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */

/* oxlint-disable typescript/explicit-module-boundary-types -- cursorAt: The exported SDK/composite API preserves inferred relationships; an explicit boundary type requires a public contract decision. */
/* oxlint-disable typescript/explicit-function-return-type -- cursorAt: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable eslint/id-length -- cursorAt: Short coordinate/index symbols follow the local layout/animation notation and library callback contract. */
/* oxlint-disable eslint/no-magic-numbers -- cursorAt: Frame offsets, normalized coordinates and animation constants specify this scene's timing and geometry. */
/* oxlint-disable unicorn/no-null -- cursorAt: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- cursorAt: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const cursorAt = (t: number) => {
  const moves = [
    [11.5, 12.5, 0.2, 600, 740, 178, 716],
    [18.1, 19.5, 0.4, 600, 740, 178, 716],
    [32.1, 33.5, 0.4, 600, 620, 249, 572],
    [41.5, 42.4, 0.3, 600, 620, 964, 522],
    [44, 45.1, 0.3, 650, 620, 962, 555],
  ];
  const move = moves.find(([start, end]): boolean => t >= start && t < end);
  if (!move) {
    return null;
  }
  const [start, , duration, ax, ay, bx, by] = move;
  const k = ease((t - start) / duration);
  return { x: ax + (bx - ax) * k, y: ay + (by - ay) * k };
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (beats, captionBeats, clamp, cursorAt, DURATION, ease, FPS, presentationAt, script, stateAt); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/id-length */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
export {
  beats,
  captionBeats,
  clamp,
  cursorAt,
  DURATION,
  ease,
  FPS,
  presentationAt,
  script,
  stateAt,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (LaunchScript, PathId, ReplyState, StoryState); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { LaunchScript, PathId, ReplyState, StoryState };
/* oxlint-enable import/no-named-export */
