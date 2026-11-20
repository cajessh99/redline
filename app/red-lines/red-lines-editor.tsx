"use client";

import { useState } from "react";
import type { StoredRedLine } from "../../lib/red-lines/store.ts";
import { setRedLineEnabled } from "./actions.ts";
import { RedLineList } from "./red-line-list.tsx";
import { initialSwitch, transition, type SwitchEvent, type SwitchState } from "./switch-state.ts";

/** The red lines list with live switches. Each switch saves on its own, right away. */
export function RedLinesEditor({ initial }: { initial: StoredRedLine[] }) {
  const [states, setStates] = useState<Record<string, SwitchState>>(() =>
    Object.fromEntries(initial.map((redLine) => [redLine.rowId, initialSwitch(redLine.enabled)])),
  );

  const stateOf = (redLine: StoredRedLine) => states[redLine.rowId] ?? initialSwitch(redLine.enabled);

  function apply(rowId: string, next: SwitchState) {
    setStates((current) => ({ ...current, [rowId]: next }));
  }

  async function send(redLine: StoredRedLine, event: SwitchEvent) {
    const { state, effect } = transition(stateOf(redLine), event);
    apply(redLine.rowId, state);
    if (!effect) return;
    let result: Awaited<ReturnType<typeof setRedLineEnabled>>;
    try {
      result = await setRedLineEnabled(redLine.rowId, effect.save);
    } catch {
      result = { ok: false };
    }
    apply(
      redLine.rowId,
      transition(state, result.ok ? { type: "saved", enabled: result.enabled } : { type: "failed" }).state,
    );
  }

  return <RedLineList redLines={initial} stateOf={stateOf} send={(redLine, event) => void send(redLine, event)} />;
}
