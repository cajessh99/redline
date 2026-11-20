import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normaliseText } from "../../lib/intake/normalise.ts";
import {
  MAX_DOCUMENT_CHARS,
  normalisePastedText,
  readPlainTextFile,
} from "../../lib/intake/text-file.ts";

const raw = readFileSync(new URL("../fixtures/one-sided-services-agreement.txt", import.meta.url), "utf8");
const stored = normaliseText(raw);
const sentence =
  "Contractor hereby assigns to Client all right, title, and interest in all work product, code, tools, libraries, and other materials that Contractor has created at any time, whether before or during the term of this Agreement and whether or not created in performing the Services.";

describe("readPlainTextFile", () => {
  it("returns the normalised text of the fixture contract", async () => {
    const file = new File([raw], "agreement.txt", { type: "text/plain" });
    const result = await readPlainTextFile(file);
    expect(result).toEqual({ ok: true, text: stored });
    expect(result.ok && result.text.includes(sentence)).toBe(true);
  });

  it("gives the same stored text for a CRLF copy of the file", async () => {
    const crlf = raw.replace(/\r?\n/g, "\r\n");
    expect(crlf).not.toBe(raw);
    const result = await readPlainTextFile(new File([crlf], "agreement.txt", { type: "text/plain" }));
    expect(result).toEqual({ ok: true, text: stored });
  });

  it("accepts a .txt name even when the browser gives no type", async () => {
    const result = await readPlainTextFile(new File([raw], "Agreement.TXT"));
    expect(result).toEqual({ ok: true, text: stored });
  });

  it("refuses an empty file", async () => {
    const result = await readPlainTextFile(new File([], "empty.txt", { type: "text/plain" }));
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a file that is only whitespace", async () => {
    const file = new File([" \r\n\t\n   \n\n "], "blank.txt", { type: "text/plain" });
    expect(await readPlainTextFile(file)).toEqual({ ok: false, reason: "empty" });
  });

  it("refuses a file that is not plain text", async () => {
    const file = new File(["%PDF-1.7"], "agreement.pdf", { type: "application/pdf" });
    expect(await readPlainTextFile(file)).toEqual({ ok: false, reason: "unsupported_format" });
  });

  it("refuses binary content under a .txt name", async () => {
    const file = new File([new Uint8Array([0x50, 0x4b, 0x00, 0x03])], "agreement.txt");
    expect(await readPlainTextFile(file)).toEqual({ ok: false, reason: "not_text" });
  });

  it("refuses text longer than the limit", async () => {
    const file = new File(["a".repeat(MAX_DOCUMENT_CHARS + 1)], "long.txt", { type: "text/plain" });
    expect(await readPlainTextFile(file)).toEqual({ ok: false, reason: "too_long" });
  });
});

describe("normalisePastedText", () => {
  it("applies the same normalisation as a file", () => {
    expect(normalisePastedText(raw)).toEqual({ ok: true, text: stored });
    expect(normalisePastedText(raw.replace(/\n/g, "\r\n"))).toEqual({ ok: true, text: stored });
  });

  it("is idempotent on its own output", () => {
    const once = normalisePastedText(raw);
    expect(once.ok && normalisePastedText(once.text)).toEqual(once);
  });

  it("refuses pasted whitespace", () => {
    expect(normalisePastedText("  \n\n\t ")).toEqual({ ok: false, reason: "empty" });
  });
});
