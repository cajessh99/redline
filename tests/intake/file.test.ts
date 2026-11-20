// PDF, Word and plain-text intake through the one dispatcher, run on real fixture bytes with the
// real pdf.js and mammoth (ticket 06; spec stories 1 to 3 and 6, "Document intake"; PRD T10).
// The fixtures are made by scripts/make-intake-fixtures.ts; tests build edge cases with the same
// writers.
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONTRACT_FILE_ACCEPT,
  CONTRACT_REFUSAL_MESSAGES,
  detectFormat,
  readContractFile,
  takeContractFile,
  type ContractFileResult,
} from "../../lib/intake/file.ts";
import { normaliseText } from "../../lib/intake/normalise.ts";
import { looksScanned, SCANNED_MIN_CHARS_PER_PAGE } from "../../lib/intake/pdf.ts";
import { MAX_DOCUMENT_CHARS } from "../../lib/intake/text-file.ts";
import {
  buildDocx,
  buildPdf,
  fixtureParagraphs,
  textPages,
} from "../../scripts/make-intake-fixtures.ts";
import { loadContract } from "../support/fake-model.ts";

const intake = (name: string) => readFileSync(new URL(`../fixtures/intake/${name}`, import.meta.url));
const asFile = (bytes: Uint8Array, name: string, type = "") => new File([new Uint8Array(bytes)], name, { type });
const rawTxt = readFileSync(new URL("../fixtures/one-sided-services-agreement.txt", import.meta.url), "utf8");
const { text: storedTxt, sidecar } = loadContract("one-sided-services-agreement");
/** One page holding a single paragraph, wrapped to fit. */
const pageOf = (text: string) => textPages([text])[0];

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function textOf(result: ContractFileResult): string {
  if (!result.ok) throw new Error(`refused: ${result.reason}`);
  return result.text;
}

// Intake runs in the browser and sends nothing. Any network call during a read fails the test.
const fetchSpy = vi.fn(() => Promise.reject(new Error("intake must not use the network")));
beforeEach(() => {
  fetchSpy.mockClear();
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  expect(fetchSpy).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

describe("a PDF with a text layer", () => {
  it("yields exactly the normalised text of the fixture, wrapped lines rejoined and paragraphs kept", async () => {
    const result = await readContractFile(asFile(intake("one-sided-services-agreement.pdf"), "agreement.pdf", PDF));
    expect(result).toEqual({ ok: true, text: storedTxt, format: "pdf" });
  });

  it("contains every planted sentence verbatim, including one split across a page break", async () => {
    const text = textOf(await readContractFile(asFile(intake("one-sided-services-agreement.pdf"), "agreement.pdf")));
    expect(sidecar.flags.length).toBeGreaterThanOrEqual(5);
    for (const flag of sidecar.flags) expect(text).toContain(flag.sentence);

    // The fixture's first page ends in the middle of the IP assignment sentence.
    const pages = textPages(fixtureParagraphs(rawTxt));
    expect(pages.length).toBeGreaterThan(2);
    const lastLine = pages[0].content.split("\n").at(-1) ?? "";
    expect(lastLine).toContain("(Contractor hereby assigns to Client");
    expect(text).toContain(sidecar.flags.find((f) => f.redLineId === "ip-assignment")!.sentence);
  });

  it("keeps the same paragraphs whatever width the lines were wrapped at", async () => {
    const paragraphs = fixtureParagraphs(rawTxt);
    for (const width of [60, 110]) {
      const pdf = buildPdf(textPages(paragraphs, width));
      expect(textOf(await readContractFile(asFile(pdf, "agreement.pdf")))).toBe(storedTxt);
    }
  });
});

describe("a scanned PDF", () => {
  it("is refused with the scanned message, which says why and what to do instead", async () => {
    const result = await readContractFile(asFile(intake("scanned-services-agreement.pdf"), "scan.pdf", PDF));
    expect(result).toEqual({ ok: false, reason: "scanned", message: CONTRACT_REFUSAL_MESSAGES.scanned });
    const message = CONTRACT_REFUSAL_MESSAGES.scanned;
    expect(message).toMatch(/scan or a photo/);
    expect(message).toMatch(/doesn't read those/);
    expect(message).toMatch(/misread page can't be checked/);
    expect(message).toMatch(/original file/);
    expect(message).toMatch(/PDF saved from the program it was written in/);
    expect(message).toMatch(/paste it/);
  });

  it("really is a picture of text on every page with only a footer as text", async () => {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({ data: new Uint8Array(intake("scanned-services-agreement.pdf")) });
    const doc = await task.promise;
    expect(doc.numPages).toBe(2);
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const ops = await page.getOperatorList();
      expect(ops.fnArray).toContain(pdfjs.OPS.paintImageXObject);
      const content = await page.getTextContent();
      const text = content.items.map((item) => ("str" in item ? item.str : "")).join("");
      expect(text.replace(/\s/g, "")).toBe(`Page${n}of2`);
    }
    await task.destroy();
  });

  it("is refused when the PDF has no text at all", async () => {
    const result = await readContractFile(asFile(buildPdf([{ content: "" }, { content: "" }]), "blank.pdf"));
    expect(result).toMatchObject({ ok: false, reason: "scanned" });
  });
});

describe("the scanned threshold", () => {
  // n non-whitespace characters as words of up to ten letters, wrapped onto one page.
  const word = (n: number) => ("xxxxxxxxxx".repeat(Math.ceil(n / 10)).slice(0, n).match(/.{1,10}/g) ?? []).join(" ");

  it("accepts a one-page PDF with exactly the threshold of characters and refuses one fewer", async () => {
    const at = buildPdf([pageOf(word(SCANNED_MIN_CHARS_PER_PAGE))]);
    const below = buildPdf([pageOf(word(SCANNED_MIN_CHARS_PER_PAGE - 1))]);
    expect(await readContractFile(asFile(at, "at.pdf"))).toEqual({
      ok: true,
      text: word(SCANNED_MIN_CHARS_PER_PAGE),
      format: "pdf",
    });
    expect(await readContractFile(asFile(below, "below.pdf"))).toMatchObject({ ok: false, reason: "scanned" });
  });

  it("averages across pages, so a short signature page beside a full page passes", async () => {
    const twoPages = (chars: number) => buildPdf([pageOf(word(chars)), { content: "" }]);
    expect(await readContractFile(asFile(twoPages(2 * SCANNED_MIN_CHARS_PER_PAGE), "a.pdf"))).toMatchObject({ ok: true });
    expect(await readContractFile(asFile(twoPages(2 * SCANNED_MIN_CHARS_PER_PAGE - 1), "b.pdf"))).toMatchObject({
      ok: false,
      reason: "scanned",
    });
  });

  it("counts only non-whitespace characters", () => {
    expect(looksScanned([SCANNED_MIN_CHARS_PER_PAGE])).toBe(false);
    expect(looksScanned([SCANNED_MIN_CHARS_PER_PAGE - 1])).toBe(true);
    expect(looksScanned([0, 0, 0])).toBe(true);
    expect(looksScanned([])).toBe(true);
  });
});

describe("a PDF that can't be read", () => {
  it("refuses a password-locked PDF and says so", async () => {
    const locked = buildPdf([pageOf(word300())], { lockedWithPassword: true });
    expect(await readContractFile(asFile(locked, "locked.pdf"))).toEqual({
      ok: false,
      reason: "unreadable",
      message: CONTRACT_REFUSAL_MESSAGES.password,
    });
  });

  it("refuses a damaged PDF", async () => {
    const damaged = new TextEncoder().encode("%PDF-1.4\nthis is not a PDF body at all\n");
    expect(await readContractFile(asFile(damaged, "damaged.pdf"))).toEqual({
      ok: false,
      reason: "unreadable",
      message: CONTRACT_REFUSAL_MESSAGES.damaged,
    });
  });

  function word300() {
    return "x".repeat(300);
  }
});

describe("a Word document", () => {
  it("yields exactly the normalised text of the fixture", async () => {
    const result = await readContractFile(asFile(intake("one-sided-services-agreement.docx"), "agreement.docx", DOCX));
    expect(result).toEqual({ ok: true, text: storedTxt, format: "docx" });
    for (const flag of sidecar.flags) expect(storedTxt).toContain(flag.sentence);
  });

  it("refuses a .docx with no text", async () => {
    expect(await readContractFile(asFile(buildDocx([]), "empty.docx"))).toEqual({
      ok: false,
      reason: "empty",
      message: CONTRACT_REFUSAL_MESSAGES.empty,
    });
  });

  it("refuses a file named .docx that isn't one, such as an old .doc renamed", async () => {
    const fake = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0]);
    expect(await readContractFile(asFile(fake, "agreement.docx"))).toEqual({
      ok: false,
      reason: "unreadable",
      message: CONTRACT_REFUSAL_MESSAGES.damaged,
    });
  });

  it("refuses a document longer than the limit", async () => {
    const long = buildDocx(["word ".repeat(Math.ceil(MAX_DOCUMENT_CHARS / 5) + 10)]);
    expect(await readContractFile(asFile(long, "long.docx"))).toMatchObject({ ok: false, reason: "too_long" });
  });
});

describe("plain text through the dispatcher", () => {
  it("yields the same stored text as the .txt reader", async () => {
    expect(await readContractFile(asFile(new TextEncoder().encode(rawTxt), "agreement.txt"))).toEqual({
      ok: true,
      text: storedTxt,
      format: "txt",
    });
  });

  it("refuses binary content under a .txt name", async () => {
    const result = await readContractFile(asFile(new Uint8Array([0x50, 0x4b, 0, 3]), "agreement.txt"));
    expect(result).toMatchObject({ ok: false, reason: "unreadable" });
  });
});

describe("an unsupported format", () => {
  it("refuses the .rtf fixture with a message naming PDF, Word and plain text", async () => {
    const result = await readContractFile(asFile(intake("services-agreement.rtf"), "agreement.rtf", "application/rtf"));
    expect(result).toEqual({ ok: false, reason: "unsupported", message: CONTRACT_REFUSAL_MESSAGES.unsupported });
    expect(CONTRACT_REFUSAL_MESSAGES.unsupported).toMatch(/PDF/);
    expect(CONTRACT_REFUSAL_MESSAGES.unsupported).toMatch(/Word \(\.docx\)/);
    expect(CONTRACT_REFUSAL_MESSAGES.unsupported).toMatch(/plain text \(\.txt\)/);
  });

  it.each([
    ["agreement.doc", "application/msword"],
    ["agreement.pages", ""],
    ["agreement.odt", "application/vnd.oasis.opendocument.text"],
    ["photo.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.heic", ""],
    ["agreement", "image/png"],
  ])("refuses %s (%s)", async (name, type) => {
    const result = await readContractFile(asFile(new Uint8Array([1, 2, 3]), name, type));
    expect(result).toEqual({ ok: false, reason: "unsupported", message: CONTRACT_REFUSAL_MESSAGES.unsupported });
  });
});

describe("detectFormat", () => {
  it("goes by extension, in any case, and by type only when there is no extension", () => {
    expect(detectFormat({ name: "Agreement.PDF", type: "" })).toBe("pdf");
    expect(detectFormat({ name: "a.docx", type: "application/octet-stream" })).toBe("docx");
    expect(detectFormat({ name: "a.txt", type: "" })).toBe("txt");
    expect(detectFormat({ name: "agreement", type: PDF })).toBe("pdf");
    expect(detectFormat({ name: "agreement", type: DOCX })).toBe("docx");
    expect(detectFormat({ name: "agreement", type: "text/plain" })).toBe("txt");
    expect(detectFormat({ name: "agreement.rtf", type: "text/plain" })).toBeNull();
    expect(detectFormat({ name: "agreement.doc", type: DOCX })).toBeNull();
  });

  it("lists the three formats for the file picker", () => {
    expect(CONTRACT_FILE_ACCEPT.split(",")).toEqual(expect.arrayContaining([".pdf", ".docx", ".txt", PDF, DOCX, "text/plain"]));
  });
});

describe("normalisation is idempotent on every reader's output", () => {
  it.each([
    ["one-sided-services-agreement.pdf"],
    ["one-sided-services-agreement.docx"],
  ])("%s", async (name) => {
    const text = textOf(await readContractFile(asFile(intake(name), name)));
    expect(normaliseText(text)).toBe(text);
  });

  it("the .txt", async () => {
    const text = textOf(await readContractFile(asFile(new TextEncoder().encode(rawTxt), "a.txt")));
    expect(normaliseText(text)).toBe(text);
  });
});

describe("takeContractFile", () => {
  it.each([
    ["scan.pdf", () => intake("scanned-services-agreement.pdf"), "scanned"],
    ["agreement.rtf", () => intake("services-agreement.rtf"), "unsupported"],
    ["locked.pdf", () => buildPdf([pageOf("x".repeat(300))], { lockedWithPassword: true }), "unreadable"],
    ["empty.docx", () => buildDocx([]), "empty"],
  ] as const)("never passes a refused file (%s) on towards the preview or the server", async (name, bytes, reason) => {
    const onText = vi.fn();
    const onRefused = vi.fn();
    const result = await takeContractFile(asFile(bytes(), name), { onText, onRefused });
    expect(result).toMatchObject({ ok: false, reason });
    expect(onText).not.toHaveBeenCalled();
    expect(onRefused).toHaveBeenCalledTimes(1);
    expect(onRefused).toHaveBeenCalledWith(!result.ok && result.message, reason);
  });

  it("passes an accepted file's text on exactly once", async () => {
    const onText = vi.fn();
    const onRefused = vi.fn();
    await takeContractFile(asFile(intake("one-sided-services-agreement.docx"), "a.docx"), { onText, onRefused });
    expect(onText).toHaveBeenCalledExactlyOnceWith(storedTxt, "docx");
    expect(onRefused).not.toHaveBeenCalled();
  });
});
