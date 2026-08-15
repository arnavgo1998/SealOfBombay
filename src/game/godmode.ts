/** GOD MODE — testing easter egg. To remove: delete this file and its two import lines (Title.tsx). */

import type { GameState, Meters } from './engine';
import { initialState } from './engine';
import { DAYS, ENDINGS } from './script';

export const GOD_MODE_ENABLED: boolean = true;
export const GOD_MODE_PASSWORD = 'pandurang';

/** Partial state the back room stamps onto a debug run. */
export interface DebugOverrides {
  meters?: Partial<Meters>;
  rupees?: number;
  flags?: string[];
}

/** Median mid-run baseline: every jump/preview starts from these ledgers. */
const MEDIAN_METERS: Meters = {
  household: 55,
  crown: 50,
  movement: 45,
  conscience: 50,
  suspicion: 0,
};

function withOverrides(meters: Meters, o?: DebugOverrides): Meters {
  return { ...meters, ...(o?.meters ?? {}) };
}

/**
 * A fresh run parked at `dayIndex`'s day-intro with median state (plus any
 * overrides). startDay/scene/desk flow on untouched from there.
 */
export function debugDayState(dayIndex: number, o?: DebugOverrides): GameState {
  const s = initialState();
  const idx = Math.max(0, Math.min(dayIndex, DAYS.length - 1));
  const meters = withOverrides(MEDIAN_METERS, o);
  return {
    ...s,
    dayIndex: idx,
    meters,
    flags: o?.flags ?? [],
    rupees: o?.rupees ?? 10,
    tutorialDone: true, // the back room skips the day-1 spotlight tour
    dayStart: { meters: { ...meters }, stats: { ...s.stats } },
  };
}

/**
 * The minimal state that makes resolveEnding pick `endingId`, jumped straight
 * to the ending screen. Mirrors ENDINGS order/conditions in script.ts.
 */
export function debugEndingState(endingId: string): GameState {
  const base = debugDayState(DAYS.length - 1);
  let s: GameState = base;
  switch (endingId) {
    case 'taken_in':
      s = { ...s, flags: ['arrested'], suspicionLog: [] };
      break;

    case 'what_it_cost':
      s = { ...s, meters: { ...s.meters, household: 20 } };
      break;
    case 'last_loyal_man':
      s = { ...s, meters: { ...s.meters, crown: 70, movement: 40 } };
      break;
    case 'one_of_the_others':
      s = { ...s, meters: { ...s.meters, movement: 70 } };
      break;
    case 'between_two_fires':
      s = { ...s, meters: { ...s.meters, crown: 50, movement: 50 } };
      break;
    case 'ordinary_man':
    default:
      break; // all median
  }
  return { ...s, phase: { kind: 'ending', endingId } };
}

/** Rich / broke / watched toggles — the override each one stamps on. */
export const DEBUG_TOGGLES: { id: string; label: string; overrides: DebugOverrides }[] = [
  { id: 'rich', label: 'RICH ₹99', overrides: { rupees: 99 } },
  { id: 'broke', label: 'BROKE ₹-10', overrides: { rupees: -10 } },
  { id: 'watched', label: 'WATCHED', overrides: { meters: { suspicion: 92 } } },
];

/** Day-jump button labels: DAY n + the scripted date. */
export const DEBUG_DAYS = DAYS.map((d, i) => ({ index: i, label: `DAY ${i + 1}`, date: d.date }));

/** Ending-preview buttons, in script order. */
export const DEBUG_ENDINGS = ENDINGS.map((e) => ({ id: e.id, title: e.title }));
