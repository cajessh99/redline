// The red lines page as a reader sees it (stories 11 to 14, 18), rendered from the presentational
// list, and the switch state machine that puts the switch-off warning before any save.
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RED_LINES_COPY, RedLineList, showsDescription } from "../../app/red-lines/red-line-list.tsx";
import {
  initialSwitch,
  shownEnabled,
  SWITCH_COPY,
  transition,
  type SwitchEvent,
  type SwitchState,
} from "../../app/red-lines/switch-state.ts";
import { findBannedWord } from "../../lib/copy/banned-words.ts";
import { NO_RED_LINES_MESSAGE, RED_LINES_LINK } from "../../lib/red-lines/messages.ts";
import { RUN_ERROR_MESSAGES } from "../../lib/analysis/run.ts";
import { RERUN_ERROR_MESSAGES } from "../../lib/analysis/rerun.ts";
import { checkedLine } from "../../app/analysis/result-view.tsx";
import { fromRow, seedRows, type StoredRedLine } from "../../lib/red-lines/store.ts";

const prd = readFileSync(new URL("../../PRD.md", import.meta.url), "utf8").replace(/\s+/g, " ");
const section5 = prd.slice(prd.indexOf("## 5. My red lines"), prd.indexOf("## 6."));

const list: StoredRedLine[] = seedRows().map((row, i) =>
  fromRow({ ...row, id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}` }),
);

function decode(markup: string): string {
  return markup
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function render(states: Record<string, SwitchState> = {}) {
  return decode(
    renderToStaticMarkup(
      createElement(RedLineList, {
        redLines: list,
        stateOf: (r: StoredRedLine) => states[r.rowId] ?? initialSwitch(r.enabled),
        send: () => {},
      }),
    ),
  );
}

describe("red lines page", () => {
  it("lists every red line, defaults first then offered, each with a switch showing whether it is on", () => {
    const html = render();
    let last = -1;
    for (const redLine of list) {
      const at = html.indexOf(`>${redLine.title}</h3>`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
    expect(html.indexOf(RED_LINES_COPY.defaultsHeading)).toBeLessThan(html.indexOf(RED_LINES_COPY.offeredHeading));
    const switches = [...html.matchAll(/role="switch" aria-checked="(true|false)"/g)].map((m) => m[1]);
    expect(switches).toEqual(list.map((r) => String(r.enabled)));
    expect(html).toContain(RED_LINES_COPY.count(5, 11));
  });

  it("shows each red line's tier descriptions word for word from PRD section 5, labelled by tier word", () => {
    const html = render();
    let tierCount = 0;
    for (const redLine of list) {
      const start = html.indexOf(`>${redLine.title}</h3>`);
      const end = html.indexOf("</li>", start);
      const item = html.slice(start, end);
      for (const [tier, text] of Object.entries(redLine.tiers)) {
        expect(section5).toContain(text);
        expect(item).toContain(`<dt>${tier}</dt><dd>${text}</dd>`);
        tierCount++;
      }
      // Only the tiers that exist are shown.
      const shownTiers = [...item.matchAll(/<dt>(\w+)<\/dt>/g)].map((m) => m[1]);
      expect(shownTiers).toEqual(Object.keys(redLine.tiers));
    }
    expect(tierCount).toBe(5 * 3 + 7);
  });

  it("shows a description only when it says more than the title and tier sentences", () => {
    expect(list.filter(showsDescription)).toEqual([]);
    const own = { title: "Exclusivity", description: "The client is my only client.", tiers: { Severe: "Severe always." } };
    expect(showsDescription(own)).toBe(true);
  });

  it("warns before a switch-off is saved, and saves only once the reader confirms", () => {
    const row = list[0];
    let state = initialSwitch(true);
    const saves: boolean[] = [];
    const step = (event: SwitchEvent) => {
      const next = transition(state, event);
      if (next.effect) saves.push(next.effect.save);
      state = next.state;
    };

    step({ type: "toggle" });
    expect(state.kind).toBe("confirming_off");
    expect(saves).toEqual([]);
    expect(shownEnabled(state)).toBe(true);
    const html = render({ [row.rowId]: state });
    expect(html).toContain(SWITCH_COPY.warning);
    expect(html).toContain(SWITCH_COPY.confirm);

    step({ type: "confirm_off" });
    expect(saves).toEqual([false]);
    step({ type: "saved", enabled: false });
    expect(state).toEqual(initialSwitch(false));
  });

  it("keeps a red line on when the reader backs out of the warning", () => {
    const next = transition({ kind: "confirming_off" }, { type: "cancel_off" });
    expect(next).toEqual({ state: initialSwitch(true), effect: null });
  });

  it("switches on with no warning", () => {
    const next = transition(initialSwitch(false), { type: "toggle" });
    expect(next.effect).toEqual({ save: true });
    expect(next.state.kind).toBe("saving");
  });

  it("puts the switch back and says so when a save fails", () => {
    const failedOff = transition({ kind: "saving", enabled: false, previous: true }, { type: "failed" }).state;
    expect(failedOff).toEqual({ kind: "idle", enabled: true, error: SWITCH_COPY.failed(true) });
    const html = render({ [list[0].rowId]: failedOff });
    expect(html).toContain(SWITCH_COPY.failed(true));
    expect(html).toMatch(/role="switch" aria-checked="true"/);

    const failedOn = transition({ kind: "saving", enabled: true, previous: false }, { type: "failed" }).state;
    expect(shownEnabled(failedOn)).toBe(false);
  });

  it("ignores clicks while a save is in flight", () => {
    const saving: SwitchState = { kind: "saving", enabled: true, previous: false };
    expect(transition(saving, { type: "toggle" })).toEqual({ state: saving, effect: null });
  });

  it("says when every red line is off", () => {
    const states = Object.fromEntries(list.map((r) => [r.rowId, initialSwitch(false)]));
    expect(render(states)).toContain(RED_LINES_COPY.noneOn);
  });

  it("uses no banned word in Redline's own copy", () => {
    const copy = [
      ...Object.values(RED_LINES_COPY).flatMap((v) => (typeof v === "string" ? [v] : [])),
      RED_LINES_COPY.count(5, 11),
      SWITCH_COPY.on,
      SWITCH_COPY.off,
      SWITCH_COPY.warning,
      SWITCH_COPY.confirm,
      SWITCH_COPY.cancel,
      SWITCH_COPY.saving,
      SWITCH_COPY.failed(true),
      SWITCH_COPY.failed(false),
      NO_RED_LINES_MESSAGE,
      RED_LINES_LINK,
      RUN_ERROR_MESSAGES.red_lines_unavailable,
      RERUN_ERROR_MESSAGES.red_lines_unavailable,
      checkedLine(1),
      checkedLine(5),
    ];
    for (const line of copy as string[]) expect(findBannedWord(line), line).toBeNull();
  });
});
