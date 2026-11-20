// The reader's red lines, as they read on the page (spec stories 11 to 14, 18). Presentational:
// the switch state for each row and what happens on a click come from the caller, so this renders
// on the server in tests with no browser.

import { TIERS } from "../../lib/red-lines/defaults.ts";
import type { StoredRedLine } from "../../lib/red-lines/store.ts";
import { shownEnabled, SWITCH_COPY, type SwitchEvent, type SwitchState } from "./switch-state.ts";

export const RED_LINES_COPY = {
  title: "Your red lines",
  lead: "Redline checks a contract only against the red lines you've switched on. Switch one off and it stops flagging that risk.",
  defaultsHeading: "Starting red lines",
  defaultsNote: "Every new account starts with these switched on.",
  offeredHeading: "More you can switch on",
  offeredNote: "These start switched off.",
  ownHeading: "Red lines you wrote",
  details: "What it looks for",
  matches: "What matches",
  count: (on: number, total: number) => `${on} of ${total} switched on.`,
  noneOn: "Everything is switched off, so Redline can't check a contract until you switch at least one on.",
  loadFailed: "Redline couldn't load your red lines. Reload the page to try again.",
} as const;

/**
 * Whether the description adds anything beyond the title and tier sentences. A product default's
 * description is its title as a sentence, and each offered item's description is its tier text,
 * so for those the tier sentences alone carry what matches.
 */
export function showsDescription(redLine: Pick<StoredRedLine, "title" | "description" | "tiers">): boolean {
  if (redLine.description === `${redLine.title}.`) return false;
  const tierTexts = Object.values(redLine.tiers).filter((text): text is string => typeof text === "string");
  return !tierTexts.every((text) => redLine.description.includes(text));
}

type RowProps = {
  redLine: StoredRedLine;
  state: SwitchState;
  send: (redLine: StoredRedLine, event: SwitchEvent) => void;
};

export function RedLineItem({ redLine, state, send }: RowProps) {
  const on = shownEnabled(state);
  const titleId = `red-line-${redLine.rowId}`;
  const warningId = `${titleId}-warning`;
  const confirming = state.kind === "confirming_off";
  const saving = state.kind === "saving";

  return (
    <li className="red-line-item">
      <div className="red-line-head">
        <h3 className="red-line-title" id={titleId}>
          {redLine.title}
        </h3>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={titleId}
          aria-describedby={confirming ? warningId : undefined}
          className="switch"
          disabled={saving}
          onClick={() => send(redLine, { type: "toggle" })}
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
          <span className="switch-word" aria-hidden="true">
            {saving ? SWITCH_COPY.saving : on ? SWITCH_COPY.on : SWITCH_COPY.off}
          </span>
        </button>
      </div>

      {confirming ? (
        <div className="red-line-warning">
          <p id={warningId} role="alert">
            {SWITCH_COPY.warning}
          </p>
          <div className="red-line-warning-actions">
            <button type="button" className="action action-secondary" onClick={() => send(redLine, { type: "confirm_off" })}>
              {SWITCH_COPY.confirm}
            </button>
            <button type="button" className="quiet-button" onClick={() => send(redLine, { type: "cancel_off" })}>
              {SWITCH_COPY.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {state.kind === "idle" && state.error ? (
        <p className="account-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <details className="red-line-details">
        <summary>{RED_LINES_COPY.details}</summary>
        {showsDescription(redLine) ? (
          <>
            <p className="red-line-label">{RED_LINES_COPY.matches}</p>
            <p className="red-line-text">{redLine.description}</p>
          </>
        ) : null}
        <dl className="red-line-tiers">
          {TIERS.filter((tier) => redLine.tiers[tier]).map((tier) => (
            <div key={tier} className="red-line-tier">
              <dt>{tier}</dt>
              <dd>{redLine.tiers[tier]}</dd>
            </div>
          ))}
        </dl>
      </details>
    </li>
  );
}

type ListProps = {
  redLines: readonly StoredRedLine[];
  stateOf: (redLine: StoredRedLine) => SwitchState;
  send: (redLine: StoredRedLine, event: SwitchEvent) => void;
};

/** Every red line the reader has: the starting defaults first, then the offered ones, then their own. */
export function RedLineList({ redLines, stateOf, send }: ListProps) {
  const groups = [
    { key: "default", heading: RED_LINES_COPY.defaultsHeading, note: RED_LINES_COPY.defaultsNote },
    { key: "offered", heading: RED_LINES_COPY.offeredHeading, note: RED_LINES_COPY.offeredNote },
    { key: "reader", heading: RED_LINES_COPY.ownHeading, note: null },
  ] as const;
  const on = redLines.filter((redLine) => shownEnabled(stateOf(redLine))).length;

  return (
    <>
      <p className="red-line-count" role="status">
        {RED_LINES_COPY.count(on, redLines.length)}
        {on === 0 && redLines.length > 0 ? ` ${RED_LINES_COPY.noneOn}` : null}
      </p>
      <div className="check-sheet red-line-sheet">
        {groups.map((group) => {
          const items = redLines.filter((redLine) => redLine.kind === group.key);
          if (items.length === 0) return null;
          const headingId = `red-lines-${group.key}`;
          return (
            <section key={group.key} className="red-line-group" aria-labelledby={headingId}>
              <h2 id={headingId}>{group.heading}</h2>
              {group.note ? <p className="red-line-note">{group.note}</p> : null}
              <ul className="red-line-items">
                {items.map((redLine) => (
                  <RedLineItem key={redLine.rowId} redLine={redLine} state={stateOf(redLine)} send={send} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
