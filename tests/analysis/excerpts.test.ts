import { describe, expect, it } from "vitest";
import { analyse } from "../../lib/analysis/analyse.ts";
import { normaliseText } from "../../lib/intake/normalise.ts";
import { DEFAULT_RED_LINE_IDS, TIERS, defaultEnabledRedLines } from "../../lib/red-lines/defaults.ts";
import { analysisPayload, excerptCandidate, fakeModel, loadExcerpts } from "../support/fake-model.ts";

const { excerpts, benign } = loadExcerpts();

function occurrences(text: string, sentence: string): number {
  let count = 0;
  for (let i = text.indexOf(sentence); i !== -1; i = text.indexOf(sentence, i + 1)) count++;
  return count;
}

describe("excerpt fixtures", () => {
  it("cover each default red line in each tier exactly once", () => {
    const pairs = excerpts.map((e) => `${e.redLineId}/${e.tier}`);
    const expected = DEFAULT_RED_LINE_IDS.flatMap((id) => TIERS.map((tier) => `${id}/${tier}`));
    expect(pairs.sort()).toEqual(expected.sort());
  });

  it("contain each sentence exactly once in its text, and every text is already normalised", () => {
    for (const excerpt of excerpts) {
      expect(occurrences(excerpt.text, excerpt.sentence), excerpt.sentence).toBe(1);
      expect(normaliseText(excerpt.text)).toBe(excerpt.text);
    }
    expect(normaliseText(benign.text)).toBe(benign.text);
  });
});

describe("analyse on each excerpt", () => {
  for (const excerpt of excerpts) {
    it(`flags ${excerpt.redLineId} at ${excerpt.tier} when the model returns it`, async () => {
      const model = fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, [excerptCandidate(excerpt)]));
      const result = await analyse(
        { text: excerpt.text, party: excerpt.party, redLines: defaultEnabledRedLines() },
        { model },
      );
      if (!result.ok) throw new Error(result.error.message);
      expect(result.flags).toHaveLength(1);
      const [flag] = result.flags;
      expect(flag.redLineId).toBe(excerpt.redLineId);
      expect(flag.tier).toBe(excerpt.tier);
      expect(flag.sourceSentence).toBe(excerpt.sentence);
      expect(flag.offset).toBe(excerpt.text.indexOf(excerpt.sentence));
      expect(excerpt.text.slice(flag.offset, flag.offset + flag.sourceSentence.length)).toBe(
        flag.sourceSentence,
      );
      expect(model.calls).toHaveLength(1);
    });
  }

  it("yields no flag on the benign excerpt when the model returns no matches", async () => {
    const model = fakeModel(analysisPayload(DEFAULT_RED_LINE_IDS, []));
    const result = await analyse(
      { text: benign.text, party: benign.party, redLines: defaultEnabledRedLines() },
      { model },
    );
    expect(result).toEqual({ ok: true, flags: [], checkedRedLineIds: [...DEFAULT_RED_LINE_IDS] });
  });
});
