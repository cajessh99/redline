"use client";

import { useState } from "react";
import { copyText, type CopyOutcome } from "./copy-text.ts";

export const COPY_LABEL = "Copy counter-offer";
export const COPIED_MESSAGE = "Copied. Paste it into your reply.";
export const COPY_FAILED_MESSAGE =
  "Your browser didn't let Redline copy this. Select the counter-offer above and copy it yourself.";

type Props = {
  /** Exactly what goes on the clipboard. */
  text: string;
  /** The red line, so each button has its own name for screen readers. */
  redLineTitle: string;
  /** The element holding the counter-offer; selected for the reader when copying fails. */
  targetId: string;
};

function selectTarget(targetId: string) {
  const target = document.getElementById(targetId);
  const selection = window.getSelection();
  if (!target || !selection) return;
  const range = document.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** One action that copies a counter-offer, with a polite status line saying whether it worked. */
export function CopyButton({ text, redLineTitle, targetId }: Props) {
  const [outcome, setOutcome] = useState<CopyOutcome | null>(null);

  async function onCopy() {
    setOutcome(null);
    const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    const result = await copyText(clipboard, text);
    if (result === "failed") selectTarget(targetId);
    setOutcome(result);
  }

  return (
    <div className="copy-row">
      <button type="button" className="copy-button" onClick={onCopy}>
        {COPY_LABEL}
        <span className="visually-hidden">: {redLineTitle}</span>
      </button>
      <p className="copy-status" role="status" aria-live="polite" data-outcome={outcome ?? undefined}>
        {outcome === "copied" ? COPIED_MESSAGE : outcome === "failed" ? COPY_FAILED_MESSAGE : ""}
      </p>
    </div>
  );
}
