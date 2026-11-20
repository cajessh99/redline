// The library as a reader sees it (stories 47 and 68), rendered from the presentational view, plus
// the document page's check-again and delete controls and the title field's copy. Asserts what is
// on screen: the upload action first, one real list item per document with a link named by its
// title, counts as words and numbers, the empty state, and no banned word in any new copy.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DeleteDocument } from "../../app/documents/[id]/delete-document.tsx";
import { DOCUMENT_COPY } from "../../app/documents/[id]/document-copy.ts";
import { RerunCurrent } from "../../app/documents/[id]/rerun-current.tsx";
import { countsLine, LIBRARY_COPY, LibraryView } from "../../app/library/library-view.tsx";
import { formatLibraryDate } from "../../app/library/local-date.tsx";
import { TITLE_FIELD_COPY } from "../../app/check/check-flow.tsx";
import { RERUN_ERROR_MESSAGES } from "../../lib/analysis/rerun.ts";
import { RUN_ERROR_MESSAGES } from "../../lib/analysis/run.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import type { LibraryEntry } from "../../lib/documents/library.ts";
import { routeRequest, SIGNED_IN_HOME } from "../../lib/routing.ts";

function decode(markup: string): string {
  return markup
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function readerText(markup: string): string {
  const labels = [...markup.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]);
  return decode([markup.replace(/<[^>]+>/g, " "), ...labels].join(" ")).replace(/\s+/g, " ");
}

const entries: LibraryEntry[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Independent Contractor Services Agreement: Quillmont Analytics LLC and Rowan Tellisford",
    party: "Contractor",
    createdAt: "2026-11-19T15:30:00.000Z",
    counts: { Severe: 4, Moderate: 1, Minor: 2 },
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Flat lease <Elm Row> & parking",
    party: "Tenant",
    createdAt: "2026-03-02T09:00:00.000Z",
    counts: { Severe: 0, Moderate: 0, Minor: 0 },
  },
];

function render(props: Partial<Parameters<typeof LibraryView>[0]> = {}) {
  return renderToStaticMarkup(createElement(LibraryView, { entries, notice: null, locale: "en-GB", ...props }));
}

describe("countsLine", () => {
  it("names every tier with its number, Severe first", () => {
    expect(countsLine({ Severe: 2, Moderate: 1, Minor: 0 })).toBe("2 Severe · 1 Moderate · 0 Minor");
  });

  it("says there are no flags rather than three zeros", () => {
    expect(countsLine({ Severe: 0, Moderate: 0, Minor: 0 })).toBe("No flags");
  });
});

describe("formatLibraryDate", () => {
  it("writes a readable date in the given locale and time zone", () => {
    expect(formatLibraryDate("2026-11-19T15:30:00.000Z", "en-GB", "UTC")).toBe("19 Nov 2026");
    expect(formatLibraryDate("2026-11-19T15:30:00.000Z", "en-US", "UTC")).toBe("Nov 19, 2026");
  });

  it("uses the reader's time zone, so a late check shows that day", () => {
    expect(formatLibraryDate("2026-11-20T02:00:00.000Z", "en-US", "America/Los_Angeles")).toBe("Nov 19, 2026");
  });

  it("falls back for an unknown locale and leaves an unreadable date as it came", () => {
    expect(formatLibraryDate("2026-11-19T15:30:00.000Z", "zz-invalid-!!", "UTC")).toMatch(/2026/);
    expect(formatLibraryDate("yesterday")).toBe("yesterday");
  });
});

describe("library view", () => {
  it("puts the upload action at the top, before the list", () => {
    const html = render();
    const upload = html.indexOf('href="/check"');
    expect(upload).toBeGreaterThan(-1);
    expect(upload).toBeLessThan(html.indexOf("<ul"));
    expect(readerText(html)).toContain(LIBRARY_COPY.upload);
  });

  it("lists each document as a list item with a link named by its title, its date, party and counts", () => {
    const html = render();
    const list = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
    expect(list).toContain(`aria-label="${LIBRARY_COPY.listLabel}"`);
    expect(list.match(/<li /g)).toHaveLength(2);

    const text = readerText(list);
    expect(list).toContain(`href="/documents/${entries[0].id}"`);
    expect(decode(list)).toContain(`>${entries[0].title}</a>`);
    expect(text).toContain("19 Nov 2026");
    expect(list).toContain('dateTime="2026-11-19T15:30:00.000Z"');
    expect(text).toContain("Checked as Contractor");
    expect(text).toContain("4 Severe · 1 Moderate · 2 Minor");

    expect(list).toContain(`href="/documents/${entries[1].id}"`);
    expect(decode(list)).toContain(">Flat lease <Elm Row> & parking</a>");
    expect(list).not.toContain("<Elm Row>"); // escaped in the markup
    expect(text).toContain("Checked as Tenant");
    expect(text).toContain("No flags");
  });

  it("keeps the order it is given (newest first, from listLibrary)", () => {
    const html = render();
    expect(html.indexOf(entries[0].id)).toBeLessThan(html.indexOf(entries[1].id));
  });

  it("uses no tier ink in the list: severity is a word and a number", () => {
    const html = render();
    expect(html).not.toMatch(/stamp|data-tier|severe-|moderate-|minor-/);
  });

  it("prompts a first upload when the library is empty", () => {
    const html = render({ entries: [] });
    const text = readerText(html);
    expect(html).not.toContain("<ul");
    expect(text).toContain(LIBRARY_COPY.emptyTitle);
    expect(text).toContain(LIBRARY_COPY.emptyBody);
    expect(text).toContain(LIBRARY_COPY.emptyAction);
    expect(html.match(/href="\/check"/g)).toHaveLength(2);
  });

  it("says when the library could not be loaded, and shows neither a list nor the empty state", () => {
    const html = render({ entries: null });
    expect(html).toContain('role="alert"');
    expect(readerText(html)).toContain(LIBRARY_COPY.loadFailed);
    expect(html).not.toContain("<ul");
    expect(readerText(html)).not.toContain(LIBRARY_COPY.emptyTitle);
  });

  it("reads out the status after a delete", () => {
    const html = render({ notice: LIBRARY_COPY.deleted });
    expect(html).toMatch(new RegExp(`role="status">${LIBRARY_COPY.deleted}<`));
  });
});

describe("the saved document's controls", () => {
  it("offers to check again with the current red lines", () => {
    const html = renderToStaticMarkup(createElement(RerunCurrent, { rerun: async () => null }));
    expect(readerText(html)).toContain(DOCUMENT_COPY.rerun);
    expect(readerText(html)).toContain(DOCUMENT_COPY.rerunHint);
  });

  it("offers delete as a plain button, with the confirm not yet shown and nothing that would send", () => {
    const html = renderToStaticMarkup(createElement(DeleteDocument, { documentId: entries[0].id }));
    expect(readerText(html)).toContain(DOCUMENT_COPY.delete);
    expect(html).toContain('type="button"');
    expect(html).not.toContain("<form");
    expect(readerText(html)).not.toContain(DOCUMENT_COPY.deleteWarning);
  });
});

describe("the signed-in home (story 68)", () => {
  it("is the library, and a signed-in reader at the root goes there", () => {
    expect(SIGNED_IN_HOME).toBe("/library");
    expect(routeRequest("/", true)).toEqual({ kind: "redirect", to: "/library" });
    expect(routeRequest("/library", false)).toEqual({ kind: "redirect", to: "/sign-in" });
  });
});

describe("new copy", () => {
  it("uses no banned word", () => {
    const copy = [
      ...Object.values(LIBRARY_COPY).map((value) => (typeof value === "function" ? value("Contractor") : value)),
      ...Object.values(DOCUMENT_COPY),
      ...Object.values(TITLE_FIELD_COPY),
      RUN_ERROR_MESSAGES.missing_title,
      RUN_ERROR_MESSAGES.title_too_long,
      ...Object.values(RERUN_ERROR_MESSAGES),
      readerText(render()),
      readerText(render({ entries: [] })),
      countsLine({ Severe: 0, Moderate: 0, Minor: 0 }),
    ];
    for (const text of copy) {
      expect(findBannedWord(text), text).toBeNull();
    }
  });
});
