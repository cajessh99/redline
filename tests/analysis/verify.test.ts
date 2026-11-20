import { describe, expect, it } from "vitest";
import { verifySourceSentence } from "../../lib/analysis/verify.ts";
import { normaliseText } from "../../lib/intake/normalise.ts";
import { loadContract } from "../support/fake-model.ts";

const { text: contract, sidecar } = loadContract("one-sided-services-agreement");
const planted = sidecar.flags[0].sentence;

describe("verifySourceSentence", () => {
  it("passes an exact substring and returns its offset", () => {
    expect(verifySourceSentence("Alpha. Beta gamma. Delta.", "Beta gamma.")).toEqual({ ok: true, offset: 7 });
    expect(verifySourceSentence(contract, planted)).toEqual({ ok: true, offset: contract.indexOf(planted) });
  });

  it("returns the offset of the first occurrence when the sentence repeats", () => {
    expect(verifySourceSentence("Pay now. Pay now.", "Pay now.")).toEqual({ ok: true, offset: 0 });
  });

  it("passes every planted sentence in the fixture contract", () => {
    for (const flag of sidecar.flags) {
      const result = verifySourceSentence(contract, flag.sentence);
      expect(result).toEqual({ ok: true, offset: contract.indexOf(flag.sentence) });
    }
  });

  it("fails a one-word paraphrase", () => {
    const paraphrase = planted.replace("hereby assigns", "hereby transfers");
    expect(paraphrase).not.toBe(planted);
    expect(verifySourceSentence(contract, paraphrase)).toEqual({ ok: false, reason: "not_found" });
  });

  it("fails altered whitespace: a double space, a newline, a tab or a non-breaking space for a space", () => {
    const altered = [
      planted.replace("hereby assigns", "hereby  assigns"),
      planted.replace("hereby assigns", "hereby\nassigns"),
      planted.replace("hereby assigns", "hereby\tassigns"),
      planted.replace("hereby assigns", "hereby assigns"),
    ];
    for (const sentence of altered) {
      expect(verifySourceSentence(contract, sentence)).toEqual({ ok: false, reason: "not_found" });
    }
  });

  it("fails a trailing or leading space the stored text does not have", () => {
    // The sentence ends its paragraph and opens it, so no space sits on either side of it.
    const stored = "Fees are due monthly.\n\nLate fees apply.";
    expect(verifySourceSentence(stored, "Late fees apply.")).toEqual({ ok: true, offset: 23 });
    expect(verifySourceSentence(stored, "Late fees apply. ")).toEqual({ ok: false, reason: "not_found" });
    expect(verifySourceSentence(stored, " Late fees apply.")).toEqual({ ok: false, reason: "not_found" });
    expect(verifySourceSentence(stored, "Fees are due monthly. ")).toEqual({ ok: false, reason: "not_found" });
  });

  it("passes a sentence that matches only after normalisation, and only against the normalised text", () => {
    const raw = "3. Payment\n\nClient shall pay\r\n each invoice\t within  thirty (30) days.\n";
    const sentence = "Client shall pay each invoice within thirty (30) days.";
    expect(verifySourceSentence(raw, sentence)).toEqual({ ok: false, reason: "not_found" });
    const stored = normaliseText(raw);
    expect(verifySourceSentence(stored, sentence)).toEqual({ ok: true, offset: stored.indexOf(sentence) });
  });

  it("matches a sentence spanning a paragraph break only when it carries exactly the stored break", () => {
    const stored = normaliseText("Fees are due monthly.\n\n\n   \nLate fees apply.");
    expect(stored).toBe("Fees are due monthly.\n\nLate fees apply.");
    expect(verifySourceSentence(stored, "monthly.\n\nLate")).toEqual({ ok: true, offset: 13 });
    for (const join of [" ", "\n", "\n\n\n", "\r\n\r\n", "\n \n"]) {
      expect(verifySourceSentence(stored, `monthly.${join}Late`)).toEqual({ ok: false, reason: "not_found" });
    }
  });

  it("fails on a difference in case", () => {
    expect(verifySourceSentence(contract, planted.toLowerCase())).toEqual({ ok: false, reason: "not_found" });
    expect(verifySourceSentence(contract, planted.replace("Client", "client"))).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("fails when curly and straight quotes differ, either way", () => {
    const curly = normaliseText("The Contractor’s “Deliverables” are listed below.");
    const straight = "The Contractor's \"Deliverables\" are listed below.";
    expect(verifySourceSentence(curly, straight)).toEqual({ ok: false, reason: "not_found" });
    expect(verifySourceSentence(straight, curly)).toEqual({ ok: false, reason: "not_found" });
    expect(verifySourceSentence(curly, curly)).toEqual({ ok: true, offset: 0 });
  });

  it("fails an empty or whitespace-only sentence", () => {
    for (const sentence of ["", " ", "\n\n", "\t  "]) {
      expect(verifySourceSentence(contract, sentence)).toEqual({ ok: false, reason: "empty" });
    }
    expect(verifySourceSentence("a  b", "  ")).toEqual({ ok: false, reason: "empty" });
  });
});
