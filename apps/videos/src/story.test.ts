import { describe, expect, it } from "bun:test";

import { presentationAt, script, stateAt } from "./story";

describe("Two-path story", () => {
  it("keeps the original while its alternative streams in the background", () => {
    expect(stateAt(20).selected).toBe("city");
    expect(stateAt(20).texts.city).toBe(stateAt(8).texts.city);
    expect(stateAt(21).texts.food.length).toBeGreaterThan(
      stateAt(19).texts.food.length
    );
  });
  it("continues each branch with its own follow-up", () => {
    expect(stateAt(29).followup.prompt).toBe("Make it kid-friendly.");
    expect(stateAt(38).followup.prompt).toBe("Make it vegetarian.");
    expect(stateAt(38).selected).toBe("food");
  });
  it("branches an edited prompt while retaining both original conversations", () => {
    expect(stateAt(43).editing).toBe(true);
    const branched = stateAt(48);
    expect(branched.edited).toBe(true);
    expect(branched.portoState).toBe("complete");
    expect(branched.texts).toEqual(stateAt(38).texts);
    expect(branched.budget).toBe(true);
    expect(branched.following).toBe(false);
  });
  it("uses overridden prompt copy throughout the edit", () => {
    const content = {
      ...script,
      prompt: "Explore Paris.",
      porto: { ...script.porto, prompt: "Explore Rome." },
    };
    expect(stateAt(42.3, content).editText).toBe("Explore Paris.");
    expect(stateAt(43, content).editText.startsWith("Explore ")).toBe(true);
    expect(stateAt(44, content).editText).toBe("Explore Rome.");
  });
  it("is seekable without stale follow-ups", () => {
    const a = stateAt(8);
    stateAt(38);
    expect(stateAt(8)).toEqual(a);
  });
  it("holds for reading without accelerating the following actions", () => {
    expect(presentationAt(8.5).demoTime).toBe(10);
    expect(presentationAt(9.4).demoTime).toBe(10);
    expect(presentationAt(12).demoTime).toBe(14);
  });
});
