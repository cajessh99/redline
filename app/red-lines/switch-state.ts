// The on/off switch for one red line, as a pure state machine (spec stories 14 and 18).
//
// Switching on saves straight away. Switching off first shows a warning that the risk this red
// line covers won't be flagged any more, and saves only once the reader confirms. A failed save
// puts the switch back where it was and says so. Kept pure so the order (warning before save) is
// tested without a browser.

export type SwitchState =
  | { kind: "idle"; enabled: boolean; error: string | null }
  /** The reader asked to switch off. The red line is still on; the warning is showing. */
  | { kind: "confirming_off" }
  /** A save is in flight. `enabled` is the value being saved; `previous` is restored on failure. */
  | { kind: "saving"; enabled: boolean; previous: boolean };

export type SwitchEvent =
  | { type: "toggle" }
  | { type: "confirm_off" }
  | { type: "cancel_off" }
  | { type: "saved"; enabled: boolean }
  | { type: "failed" };

/** What the caller has to do after a transition: nothing, or save this value. */
export type SwitchEffect = { save: boolean } | null;

export type Transition = { state: SwitchState; effect: SwitchEffect };

export const SWITCH_COPY = {
  on: "On",
  off: "Off",
  warning:
    "If you switch this off, Redline stops flagging this risk in contracts you check from now on, and nothing else in Redline looks for it.",
  confirm: "Switch it off",
  cancel: "Keep it on",
  saving: "Saving…",
  failed: (wasOn: boolean) =>
    `Redline couldn't save that, so this red line is still ${wasOn ? "on" : "off"}. Try again.`,
} as const;

export function initialSwitch(enabled: boolean): SwitchState {
  return { kind: "idle", enabled, error: null };
}

/** Whether the switch shows as on. While the warning shows, or a save is in flight, it shows the stored value. */
export function shownEnabled(state: SwitchState): boolean {
  if (state.kind === "idle") return state.enabled;
  if (state.kind === "confirming_off") return true;
  return state.previous;
}

export function transition(state: SwitchState, event: SwitchEvent): Transition {
  const stay: Transition = { state, effect: null };
  switch (state.kind) {
    case "idle":
      if (event.type !== "toggle") return stay;
      // Switching off never saves straight away: the warning comes first.
      if (state.enabled) return { state: { kind: "confirming_off" }, effect: null };
      return { state: { kind: "saving", enabled: true, previous: false }, effect: { save: true } };
    case "confirming_off":
      if (event.type === "confirm_off") {
        return { state: { kind: "saving", enabled: false, previous: true }, effect: { save: false } };
      }
      if (event.type === "cancel_off" || event.type === "toggle") {
        return { state: initialSwitch(true), effect: null };
      }
      return stay;
    case "saving":
      if (event.type === "saved") return { state: initialSwitch(event.enabled), effect: null };
      if (event.type === "failed") {
        return {
          state: { kind: "idle", enabled: state.previous, error: SWITCH_COPY.failed(state.previous) },
          effect: null,
        };
      }
      return stay;
  }
}
