"use client";

import { useEffect, useState } from "react";
import { clauses, flags, parties } from "./sample";

const byKey = Object.fromEntries(flags.map((f) => [f.key, f]));

export default function FlaggedPage() {
  const [open, setOpen] = useState(null);

  // On wide screens the last flag starts pulled out, below every tab, so all three tabs stay in
  // the first viewport. On phones the tabs invite the tap.
  useEffect(() => {
    if (window.matchMedia("(min-width: 901px)").matches) setOpen("term");
  }, []);

  return (
    <>
    <figure className="sheet" aria-label="Sample contract with flags">
      <figcaption className="sheet-note">Sample contract, written for this page.</figcaption>
      <p className="sheet-title">Independent Contractor Agreement</p>
      <p className="sheet-parties">Between {parties}.</p>
      <ol className="clauses">
        {clauses.map((c) => {
          const flag = c.flag && byKey[c.flag];
          if (!flag) {
            return (
              <li key={c.id} className="clause">
                <span className="clause-no">{c.id}</span> {c.text}
              </li>
            );
          }
          const isOpen = open === flag.key;
          const slipId = `slip-${flag.key}`;
          return (
            <li key={c.id} className="clause clause-flagged" data-tier={flag.tier.toLowerCase()}>
              <span className="clause-no">{c.id}</span> <mark>{c.text}</mark>
              <button
                type="button"
                className="tab"
                aria-expanded={isOpen}
                aria-controls={slipId}
                onClick={() => setOpen(isOpen ? null : flag.key)}
              >
                <span className="tab-word">{flag.tier}</span>
                <span className="visually-hidden">: {flag.redLine}</span>
              </button>
              <div id={slipId} className="slip" hidden={!isOpen}>
                <p className="slip-head">
                  <span className="stamp">{flag.tier}</span>
                  <span className="slip-line">{flag.redLine}</span>
                </p>
                <p className="slip-statement">{flag.statement}</p>
                <p className="slip-label">Source sentence, clause {flag.clause}</p>
                <blockquote className="slip-source">{flag.source}</blockquote>
                <p className="slip-label">Counter-offer</p>
                <p className="slip-counter">{flag.counter}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </figure>
    <p className="sheet-hint">Choose a tab to read its flag.</p>
    </>
  );
}
