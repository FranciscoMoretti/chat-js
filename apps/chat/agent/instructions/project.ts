import { defineDynamic, defineInstructions } from "eve/instructions";

import { projectInstructions } from "../../lib/eve/project-instructions";

export default defineDynamic({
  events: {
    "turn.started": () => {
      const { content } = projectInstructions.get();

      if (content !== null && content !== "") {
        return defineInstructions({
          content: `Project instructions:\n${content}`,
        });
      }
      return null;
    },
  },
});
