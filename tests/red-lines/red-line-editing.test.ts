// Red-line editing on the page (ticket 09): validation, the form and confirm state machines, and
// what the page renders. Pure code, rendered on the server; no browser.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EDIT_COPY } from "../../app/red-lines/edit-copy.ts";
import {
  CLOSED,
  confirmTransition,
  formTransition,
  IDLE,
  type ConfirmEvent,
  type ConfirmState,
  type FormEvent,
  type FormState,
} from "../../app/red-lines/edit-state.ts";
import { rowIds } from "../../app/red-lines/red-line-list.tsx";
import { PAGE_IDS, RedLinesView, type RedLinesViewProps } from "../../app/red-lines/red-lines-view.tsx";
import { initialSwitch } from "../../app/red-lines/switch-state.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { PRODUCT_RED_LINES } from "../../lib/red-lines/defaults.ts";
import { fromRow, nextPosition, seedRows, type StoredRedLine } from "../../lib/red-lines/store.ts";
import {
  DESCRIPTION_MAX,
  draftFrom,
  emptyDraft,
  firstInvalidField,
  TIER_MAX,
  TITLE_MAX,
  validateRedLineDraft,
  VALIDATION_COPY,
  type RedLineDraft,
} from "../../lib/red-lines/validation.ts";

const list: StoredRedLine[] = seedRows().map((row, i) =>
  fromRow({ ...row, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
);
const own: StoredRedLine = fromRow({
  id: "00000000-0000-4000-8000-0000000000aa",
  product_id: null,
  kind: "reader",
  title: "Answering client questions within two days",
  description: "The contract sets a deadline for replying to the client's questions.",
  tiers: { Minor: "Minor when the reader must answer within a few business days." },
  enabled: true,
  position: 11,
});

function decode(markup: string): string {
  return markup
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function render(overrides: Partial<RedLinesViewProps> & { forms?: Record<string, FormState>; deletes?: Record<string, ConfirmState> } = {}) {
  const { forms = {}, deletes = {}, ...rest } = overrides;
  const props: RedLinesViewProps = {
    redLines: [...list, own],
    stateOf: (r) => initialSwitch(r.enabled),
    send: () => {},
    editing: {
      formOf: (r) => forms[r.rowId] ?? CLOSED,
      sendForm: () => {},
      deleteOf: (r) => deletes[r.rowId] ?? IDLE,
      sendDelete: () => {},
    },
    addForm: CLOSED,
    sendAdd: () => {},
    restore: IDLE,
    sendRestore: () => {},
    notice: null,
    ...rest,
  };
  return decode(renderToStaticMarkup(createElement(RedLinesView, props)));
}

/** The opening tag of the element with this id, its attributes as a map, and (for a textarea) its text. */
function element(html: string, id: string): { attrs: Record<string, string>; text: string } {
  const match = html.match(new RegExp(`<([a-z]+)([^>]* id="${id}"[^>]*)>`));
  if (!match) throw new Error(`no element with id ${id}`);
  const attrs = Object.fromEntries([...match[2].matchAll(/([A-Za-z-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]));
  const rest = html.slice((match.index ?? 0) + match[0].length);
  const text = match[1] === "textarea" ? rest.slice(0, rest.indexOf("</textarea>")) : "";
  return { attrs, text };
}

function valid(): RedLineDraft {
  return {
    title: "  Exclusivity  ",
    description: "The client is my only client.",
    tiers: { Severe: "Severe when it outlasts the job.", Moderate: "", Minor: "  " },
  };
}

describe("validateRedLineDraft", () => {
  it("trims the wording and drops empty tiers", () => {
    expect(validateRedLineDraft(valid())).toEqual({
      ok: true,
      value: { title: "Exclusivity", description: "The client is my only client.", tiers: { Severe: "Severe when it outlasts the job." } },
    });
  });

  it("needs a title, a description and at least one tier", () => {
    const result = validateRedLineDraft({ title: " ", description: "", tiers: { Severe: "", Moderate: " ", Minor: "" } });
    expect(result).toEqual({
      ok: false,
      errors: {
        title: VALIDATION_COPY.titleRequired,
        description: VALIDATION_COPY.descriptionRequired,
        tiers: VALIDATION_COPY.tierRequired,
      },
    });
  });

  it("refuses text over each field's limit, and accepts text at it", () => {
    const at = { title: "t".repeat(TITLE_MAX), description: "d".repeat(DESCRIPTION_MAX), tiers: { Minor: "m".repeat(TIER_MAX) } };
    expect(validateRedLineDraft(at).ok).toBe(true);
    const over = validateRedLineDraft({
      title: "t".repeat(TITLE_MAX + 1),
      description: "d".repeat(DESCRIPTION_MAX + 1),
      tiers: { Severe: "s", Minor: "m".repeat(TIER_MAX + 1) },
    });
    expect(over).toEqual({
      ok: false,
      errors: {
        title: VALIDATION_COPY.tooLong(TITLE_MAX),
        description: VALIDATION_COPY.tooLong(DESCRIPTION_MAX),
        Minor: VALIDATION_COPY.tooLong(TIER_MAX),
      },
    });
  });

  it("treats anything that isn't a draft as empty, and ignores unknown tiers", () => {
    expect(validateRedLineDraft(null).ok).toBe(false);
    expect(validateRedLineDraft("title").ok).toBe(false);
    const result = validateRedLineDraft({ title: 1, description: "d", tiers: { Extreme: "x" } });
    expect(result).toEqual({ ok: false, errors: { title: VALIDATION_COPY.titleRequired, tiers: VALIDATION_COPY.tierRequired } });
  });

  it("accepts every shipped red line as it stands", () => {
    for (const redLine of PRODUCT_RED_LINES) {
      expect(validateRedLineDraft(draftFrom(redLine))).toEqual({
        ok: true,
        value: { title: redLine.title, description: redLine.description, tiers: redLine.tiers },
      });
    }
  });

  it("names the first wrong field in form order", () => {
    expect(firstInvalidField({ Minor: "x", description: "y" })).toBe("description");
    expect(firstInvalidField({ Moderate: "x", tiers: "y" })).toBe("tiers");
    expect(firstInvalidField({})).toBeNull();
  });
});

describe("nextPosition", () => {
  it("puts a new red line after everything, and never among the product positions", () => {
    expect(nextPosition([])).toBe(11);
    expect(nextPosition([{ position: 0 }, { position: 3 }])).toBe(11);
    expect(nextPosition([{ position: 10 }, { position: 14 }])).toBe(15);
  });
});

describe("the edit form state machine", () => {
  function run(events: FormEvent[], start: FormState = CLOSED) {
    let state = start;
    const effects: unknown[] = [];
    for (const event of events) {
      const next = formTransition(state, event);
      state = next.state;
      if (next.effect) effects.push(next.effect);
    }
    return { state, effects };
  }

  it("opens on the current wording and focuses the first field", () => {
    const { state, effects } = run([{ type: "open", draft: draftFrom(own) }]);
    expect(state).toEqual({ kind: "open", draft: draftFrom(own), errors: {}, failed: false });
    expect(effects).toEqual([{ type: "focus", target: "first" }]);
  });

  it("saves only a draft that passes validation, and returns focus to Edit once saved", () => {
    const { state, effects } = run([
      { type: "open", draft: draftFrom(own) },
      { type: "change", field: "title", value: "New title" },
      { type: "change", field: "Severe", value: "Severe when it has no end date." },
      { type: "submit" },
    ]);
    expect(state.kind).toBe("saving");
    expect(effects.at(-1)).toEqual({
      type: "save",
      wording: {
        title: "New title",
        description: own.description,
        tiers: { Severe: "Severe when it has no end date.", Minor: own.tiers.Minor },
      },
    });
    expect(formTransition(state, { type: "saved" })).toEqual({ state: CLOSED, effect: { type: "focus", target: "opener" } });
  });

  it("shows errors and focuses the first wrong field instead of saving", () => {
    const { state, effects } = run([
      { type: "open", draft: draftFrom(own) },
      { type: "change", field: "title", value: "" },
      { type: "change", field: "Minor", value: "" },
      { type: "submit" },
    ]);
    expect(state).toMatchObject({ kind: "open", errors: { title: VALIDATION_COPY.titleRequired, tiers: VALIDATION_COPY.tierRequired } });
    expect(effects.some((e) => (e as { type: string }).type === "save")).toBe(false);
    expect(effects.at(-1)).toEqual({ type: "focus", target: "title" });
    // Typing in a tier clears the "at least one tier" message; typing in the title clears its own.
    const typed = run([{ type: "change", field: "Moderate", value: "M" }, { type: "change", field: "title", value: "T" }], state).state;
    expect(typed).toMatchObject({ kind: "open", errors: {} });
  });

  it("puts the draft back with the server's field errors, or a general failure", () => {
    const saving: FormState = { kind: "saving", draft: valid() };
    const rejected = formTransition(saving, { type: "failed", errors: { description: "Too long." } });
    expect(rejected).toEqual({
      state: { kind: "open", draft: valid(), errors: { description: "Too long." }, failed: false },
      effect: { type: "focus", target: "description" },
    });
    const failed = formTransition(saving, { type: "failed", errors: null });
    expect(failed).toEqual({ state: { kind: "open", draft: valid(), errors: {}, failed: true }, effect: null });
  });

  it("ignores typing, a second submit and cancel while a save is in flight", () => {
    const saving: FormState = { kind: "saving", draft: valid() };
    for (const event of [{ type: "submit" }, { type: "cancel" }, { type: "change", field: "title", value: "x" }] as FormEvent[]) {
      expect(formTransition(saving, event)).toEqual({ state: saving, effect: null });
    }
  });

  it("cancels without saving and returns focus to the button that opened it", () => {
    const { state, effects } = run([{ type: "open", draft: emptyDraft() }, { type: "change", field: "title", value: "x" }, { type: "cancel" }]);
    expect(state).toEqual(CLOSED);
    expect(effects).toEqual([{ type: "focus", target: "first" }, { type: "focus", target: "opener" }]);
  });
});

describe("the delete and restore state machine", () => {
  it("shows the warning before anything is sent, and runs only on confirm", () => {
    const row = own;
    const asked = confirmTransition(IDLE, { type: "ask" });
    expect(asked).toEqual({ state: { kind: "confirming" }, effect: { type: "focus", target: "warning" } });
    // While confirming, the warning is on the page and nothing has run.
    const html = render({ deletes: { [row.rowId]: asked.state } });
    expect(html).toContain(`<p id="${rowIds(row.rowId).deleteWarning}" role="alert" tabindex="-1">${EDIT_COPY.deleteWarningOwn}</p>`);
    expect(html).toContain(EDIT_COPY.deleteConfirm);

    const confirmed = confirmTransition(asked.state, { type: "confirm" });
    expect(confirmed).toEqual({ state: { kind: "working" }, effect: { type: "run" } });
    expect(confirmTransition(confirmed.state, { type: "done" })).toEqual({ state: IDLE, effect: null });
  });

  it("runs nothing on a stray confirm, and backs out to the opener on cancel", () => {
    expect(confirmTransition(IDLE, { type: "confirm" })).toEqual({ state: IDLE, effect: null });
    expect(confirmTransition({ kind: "confirming" }, { type: "cancel" })).toEqual({ state: IDLE, effect: { type: "focus", target: "opener" } });
    const working: ConfirmState = { kind: "working" };
    for (const event of [{ type: "ask" }, { type: "confirm" }, { type: "cancel" }] as ConfirmEvent[]) {
      expect(confirmTransition(working, event)).toEqual({ state: working, effect: null });
    }
  });

  it("says so when it fails", () => {
    const failed = confirmTransition({ kind: "working" }, { type: "failed" });
    expect(failed).toEqual({ state: { kind: "idle", failed: true }, effect: { type: "focus", target: "opener" } });
    expect(render({ deletes: { [own.rowId]: failed.state } })).toContain(EDIT_COPY.deleteFailed);
    expect(render({ restore: failed.state })).toContain(EDIT_COPY.restoreFailed);
  });

  it("warns that a deleted product item comes back with restore, and an own one doesn't", () => {
    const ip = list[0];
    const html = render({ deletes: { [ip.rowId]: { kind: "confirming" } } });
    expect(html).toContain(EDIT_COPY.deleteWarningProduct);
    expect(html).not.toContain(EDIT_COPY.deleteWarningOwn);
  });

  it("shows the restore warning before restoring", () => {
    const html = render({ restore: { kind: "confirming" } });
    expect(html).toContain(`<p id="${PAGE_IDS.restoreWarning}" role="alert" tabindex="-1">${EDIT_COPY.restoreWarning}</p>`);
    expect(html).toContain(EDIT_COPY.restoreConfirm);
    expect(render()).not.toContain(EDIT_COPY.restoreWarning);
  });
});

describe("the red lines page with editing", () => {
  it("offers Edit and Delete on every red line, named for screen readers, plus add and restore", () => {
    const html = render();
    for (const redLine of [...list, own]) {
      const ids = rowIds(redLine.rowId);
      expect(html).toContain(`id="${ids.edit}"`);
      expect(html).toContain(`id="${ids.delete}"`);
      expect(html).toContain(`${EDIT_COPY.edit}<span class="visually-hidden"> ${redLine.title}</span>`);
    }
    expect(html).toContain(`id="${PAGE_IDS.add}"`);
    expect(html).toContain(`>${EDIT_COPY.restore}</button>`);
  });

  it("renders the edit form with the red line's current values, labelled and described", () => {
    const ids = rowIds(own.rowId);
    const html = render({ forms: { [own.rowId]: { kind: "open", draft: draftFrom(own), errors: {}, failed: false } } });
    const base = ids.form;
    expect(html).toContain(EDIT_COPY.editHeading);
    expect(html).toContain(`<label for="${base}-title">${EDIT_COPY.titleLabel}</label>`);
    expect(element(html, `${base}-title`).attrs).toMatchObject({ value: own.title, "aria-describedby": `${base}-title-hint` });
    expect(element(html, `${base}-title-hint`).attrs.class).toBe("field-hint");
    expect(element(html, `${base}-description`)).toMatchObject({
      attrs: { "aria-describedby": `${base}-description-hint` },
      text: own.description,
    });
    expect(html).toContain(`<label for="${base}-description">${EDIT_COPY.descriptionLabel}</label>`);
    expect(element(html, `${base}-minor`)).toMatchObject({ attrs: { "aria-describedby": `${base}-minor-hint` }, text: own.tiers.Minor });
    expect(element(html, `${base}-severe`).text).toBe("");
    expect(element(html, `${base}-moderate`).text).toBe("");
    expect(html).toContain(`<label for="${base}-minor">Minor</label>`);
    // Each tier is explained the PRD section 5 way.
    for (const hint of Object.values(EDIT_COPY.tierHints)) expect(html).toContain(hint);
    // The Edit button is replaced by the form while it is open.
    expect(html).not.toContain(`id="${ids.edit}"`);
  });

  it("ties each error to its field with aria-describedby and aria-invalid", () => {
    const base = rowIds(own.rowId).form;
    const html = render({
      forms: {
        [own.rowId]: {
          kind: "open",
          draft: { ...draftFrom(own), title: "", tiers: { Severe: "", Moderate: "", Minor: "" } },
          errors: { title: VALIDATION_COPY.titleRequired, tiers: VALIDATION_COPY.tierRequired },
          failed: false,
        },
      },
    });
    expect(element(html, `${base}-title`).attrs).toMatchObject({
      "aria-invalid": "true",
      "aria-describedby": `${base}-title-hint ${base}-title-error`,
    });
    expect(html).toContain(`<p class="field-error" id="${base}-title-error">${VALIDATION_COPY.titleRequired}</p>`);
    expect(html).toContain(`<p class="field-error" id="${base}-tiers-error">${VALIDATION_COPY.tierRequired}</p>`);
    expect(element(html, `${base}-severe`).attrs).toMatchObject({
      "aria-invalid": "true",
      "aria-describedby": `${base}-severe-hint ${base}-tiers-error`,
    });
  });

  it("shows the add form, empty, in place of the add button", () => {
    const html = render({ addForm: { kind: "open", draft: emptyDraft(), errors: {}, failed: false } });
    expect(html).toContain(`<h2 class="red-line-form-heading" id="${PAGE_IDS.addForm}-heading">${EDIT_COPY.addHeading}</h2>`);
    expect(element(html, `${PAGE_IDS.addForm}-title`).attrs.value).toBe("");
    expect(html).toContain(EDIT_COPY.saveNew);
    expect(html).not.toContain(`id="${PAGE_IDS.add}"`);
  });

  it("shows a general save failure without losing the draft", () => {
    const draft = { ...draftFrom(own), title: "Kept wording" };
    const html = render({ addForm: { kind: "open", draft, errors: {}, failed: true } });
    expect(html).toContain(EDIT_COPY.saveFailed);
    expect(html).toContain('value="Kept wording"');
  });

  it("shows an empty state that offers add and restore when there are no red lines", () => {
    const html = render({ redLines: [] });
    expect(html).toContain(EDIT_COPY.emptyHeading);
    expect(html).toContain(EDIT_COPY.emptyBody);
    expect(html).toContain(`id="${PAGE_IDS.add}"`);
    expect(html).toContain(`id="${PAGE_IDS.restore}"`);
    expect(html).not.toContain('role="switch"');
  });

  it("reads out what the last action did in a focusable status line", () => {
    const html = render({ notice: EDIT_COPY.deleted(own.title) });
    expect(html).toContain(`<p class="red-line-notice" id="${PAGE_IDS.notice}" role="status" tabindex="-1">${EDIT_COPY.deleted(own.title)}</p>`);
  });

  it("uses no banned word in the new copy", () => {
    const copy: string[] = [
      ...Object.values(EDIT_COPY).flatMap((v) => (typeof v === "string" ? [v] : [])),
      ...Object.values(EDIT_COPY.tierHints),
      EDIT_COPY.deleted("Late fees"),
      EDIT_COPY.added("Late fees"),
      EDIT_COPY.saved("Late fees"),
      VALIDATION_COPY.titleRequired,
      VALIDATION_COPY.descriptionRequired,
      VALIDATION_COPY.tierRequired,
      VALIDATION_COPY.tooLong(TITLE_MAX),
    ];
    expect(copy.length).toBeGreaterThan(40);
    for (const line of copy) expect(findBannedWord(line), line).toBeNull();
  });
});
