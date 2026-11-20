// The party picker and "Change my party", rendered to HTML with React's server renderer, plus the
// choice logic the check flow uses to refuse to start without a party. Nothing is ever preselected.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CHANGE_PARTY_COPY, ChangeParty } from "../../app/check/change-party.tsx";
import {
  chosenParty,
  NO_PARTY,
  OTHER_PARTY,
  PARTY_COPY,
  PARTY_PROBLEM_MESSAGES,
  partyFocusId,
  PartyPicker,
  partyProblem,
  type PartyChoice,
  type PartyProblem,
} from "../../app/check/party-picker.tsx";
import { RERUN_ERROR_MESSAGES } from "../../lib/analysis/rerun.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { findPartyCandidates } from "../../lib/intake/parties.ts";
import { loadContract } from "../support/fake-model.ts";

const { text } = loadContract("one-sided-services-agreement");
const candidates = findPartyCandidates(text);

function picker(choice: PartyChoice, names: readonly string[] = candidates, problem: PartyProblem | null = null) {
  return renderToStaticMarkup(
    createElement(PartyPicker, { idBase: "p", candidates: names, choice, onChange: () => {}, problem }),
  );
}

function radios(html: string): string[] {
  return html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
}

describe("PartyPicker", () => {
  it("offers each name found in the contract, plus a different name, inside a fieldset with a legend", () => {
    const html = picker(NO_PARTY);
    expect(html).toMatch(/^<fieldset[^>]*class="party-picker"/);
    expect(html).toContain(`<legend>${PARTY_COPY.legend}</legend>`);
    const inputs = radios(html);
    expect(inputs).toHaveLength(3);
    expect(inputs.map((input) => input.match(/id="([^"]+)"/)?.[1])).toEqual(["p-option-0", "p-option-1", "p-option-2"]);
    for (const [i, label] of ["Client", "Contractor", PARTY_COPY.other].entries()) {
      expect(html).toContain(`<label class="party-option" for="p-option-${i}">`);
      expect(html).toContain(`<span>${label}</span>`);
    }
  });

  it("never preselects an option", () => {
    for (const html of [picker(NO_PARTY), picker({ picked: null, typed: "Contractor" })]) {
      expect(radios(html).filter((input) => / checked=""/.test(input))).toEqual([]);
    }
  });

  it("checks only the option the reader picked", () => {
    const checked = radios(picker({ picked: "Contractor", typed: "" })).filter((input) => / checked=""/.test(input));
    expect(checked).toHaveLength(1);
    expect(checked[0]).toContain('value="Contractor"');
  });

  it("shows a labelled field for a different name only once that option is picked", () => {
    expect(picker(NO_PARTY)).not.toContain('id="p-typed"');
    const html = picker({ picked: OTHER_PARTY, typed: "" });
    expect(html).toContain(`<label for="p-typed">${PARTY_COPY.otherLabel}</label>`);
    expect(html).toMatch(/<input id="p-typed"[^>]*type="text"/);
  });

  it("asks the reader to type their party when no names were found", () => {
    const html = picker(NO_PARTY, []);
    expect(radios(html)).toEqual([]);
    expect(html).toContain(`<label for="p-typed">${PARTY_COPY.typedLabel}</label>`);
    expect(html).toContain(PARTY_COPY.typedHint.replace(/'/g, "&#x27;"));
    expect(html).toMatch(/<input id="p-typed"[^>]*value=""/);
  });

  it("ties the error to the group and marks the typed field invalid", () => {
    const html = picker(NO_PARTY, candidates, "not_picked");
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="p-hint p-error"/);
    expect(html).toContain(`<p class="field-error" id="p-error">${PARTY_PROBLEM_MESSAGES.not_picked.replace(/'/g, "&#x27;")}</p>`);
    const typed = picker(NO_PARTY, [], "not_typed");
    expect(typed).toMatch(/<input id="p-typed"[^>]*aria-invalid="true"[^>]*aria-describedby="p-hint p-error"/);
  });
});

describe("choosing a party", () => {
  it("has no party until the reader picks or types one", () => {
    expect(chosenParty(NO_PARTY, candidates)).toBe("");
    expect(partyProblem(NO_PARTY, candidates)).toBe("not_picked");
    expect(partyProblem(NO_PARTY, [])).toBe("not_typed");
    expect(partyProblem({ picked: OTHER_PARTY, typed: "   " }, candidates)).toBe("not_typed");
    // Text typed earlier does not count unless the reader picked "a different name".
    expect(chosenParty({ picked: null, typed: "Contractor" }, candidates)).toBe("");
  });

  it("returns the picked name, or the typed one trimmed", () => {
    expect(chosenParty({ picked: "Client", typed: "" }, candidates)).toBe("Client");
    expect(chosenParty({ picked: OTHER_PARTY, typed: "  Subcontractor " }, candidates)).toBe("Subcontractor");
    expect(chosenParty({ picked: null, typed: " Tenant " }, [])).toBe("Tenant");
    expect(partyProblem({ picked: "Client", typed: "" }, candidates)).toBeNull();
  });

  it("does not accept a picked name the contract does not define", () => {
    expect(chosenParty({ picked: "Landlord", typed: "" }, candidates)).toBe("");
  });

  it("focuses the first option, or the typed field, when no party is chosen", () => {
    expect(partyFocusId("p", NO_PARTY, candidates)).toBe("p-option-0");
    expect(partyFocusId("p", NO_PARTY, [])).toBe("p-typed");
    expect(partyFocusId("p", { picked: OTHER_PARTY, typed: "" }, candidates)).toBe("p-typed");
  });
});

describe("ChangeParty", () => {
  it("starts closed, as a button that controls the panel", () => {
    const html = renderToStaticMarkup(
      createElement(ChangeParty, { candidates, currentParty: "Contractor", rerun: async () => null }),
    );
    expect(html).toMatch(/<button type="button" id="[^"]+" class="quiet-button" aria-expanded="false" aria-controls="[^"]+">Change my party<\/button>/);
    expect(radios(html)).toEqual([]);
  });
});

describe("party copy", () => {
  it("uses no banned word", () => {
    const copy = [
      ...Object.values(PARTY_COPY),
      ...Object.values(PARTY_PROBLEM_MESSAGES),
      ...Object.values(RERUN_ERROR_MESSAGES),
      ...Object.values(CHANGE_PARTY_COPY).map((value) => (typeof value === "function" ? value("Contractor") : value)),
    ];
    for (const line of copy) expect(findBannedWord(line), line).toBeNull();
  });
});
