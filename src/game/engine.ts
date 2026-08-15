// ============================================================================
// THE SEAL OF BOMBAY — game engine
// Pure state functions + a React hook. All narrative data lives in script.ts.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import type { Beat, Choice, Condition, Effects, Ending, Risk } from './script';
import { DAYS, ENDINGS, EVENT_BEATS } from './script';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface Meters {
  household: number;
  crown: number;
  movement: number;
  conscience: number; // hidden — never rendered
  suspicion: number; // hidden — never rendered; >= 100 ends the game
}

export interface Stats {
  approved: number;
  denied: number;
  detained: number;
  bribes: number;
  bribeRupees: number; // total rupees taken in bribes (for the day ledger)
}

export type SceneSegment = 'morning' | 'evening';

export type Phase =
  | { kind: 'dayIntro' }
  // chainId set = the beat lives in an EVENT_BEATS chain played before the
  // day's own morning beats; segment stays 'morning' for the scene chrome.
  | { kind: 'scene'; segment: SceneSegment; beatId: string; chainId?: string }
  | { kind: 'desk'; caseIndex: number }
  | { kind: 'summary' }
  | { kind: 'arrest' }
  | { kind: 'ending'; endingId: string };

export interface DaySnapshot {
  meters: Meters;
  stats: Stats;
}

export interface GameState {
  dayIndex: number; // 0-based index into DAYS
  phase: Phase;
  meters: Meters;
  flags: string[];
  credibilityDebt: number; // count of flagrant corrupt acts
  stats: Stats;
  daysServed: number;
  rulebookSeenDay: number; // dayIndex whose rulebook has auto-opened (-1 = none)
  rupees: number; // running household cash ledger: salary + bribes - householdCost + choice deltas
  consecutiveShortfalls: number; // days in a row the tin box ended negative
  dayChoiceNet: number; // sum of ALL rupee deltas from beats this day (the ledger's AT HOME line)
  lastShortfall: number; // extra household hit applied at the last day end (0 = none)
  dayStart: DaySnapshot;
  log: string[];
  stampedCases: string[]; // case ids already stamped (guards reload re-stamping)
  suspicionLog: string[]; // last ≤5 short reasons suspicion rose (arrest ledger)
  tutorialDone: boolean; // day-1 case-1 spotlight walkthrough shown (once per save)
}

export type DeskAction = 'approve' | 'deny' | 'detain' | 'bribe';

export interface StampResult {
  outcomeText: string;
  riskText?: string;
  riskSuccess?: boolean;
  /** The applied outcome carries a story note or flag — meant to be read in full. */
  moralWeight?: boolean;
}

// v4: moral-dilemma cases shifted indices; the state grew choice-spend
// tracking and debt escalation. Old saves are discarded on purpose.
export const SAVE_KEY = 'seal-of-bombay-save-v4';

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const clamp = (v: number): number => Math.max(0, Math.min(100, Math.round(v)));

export function initialState(): GameState {
  const meters: Meters = { household: 60, crown: 50, movement: 50, conscience: 50, suspicion: 0 };
  const stats: Stats = { approved: 0, denied: 0, detained: 0, bribes: 0, bribeRupees: 0 };
  return {
    dayIndex: 0,
    phase: { kind: 'dayIntro' },
    meters,
    flags: [],
    credibilityDebt: 0,
    stats,
    daysServed: 0,
    rulebookSeenDay: -1,
    rupees: 0,
    lastShortfall: 0,
    consecutiveShortfalls: 0,
    dayChoiceNet: 0,
    dayStart: { meters: { ...meters }, stats: { ...stats } },
    log: [],
    stampedCases: [],
    suspicionLog: [],
    tutorialDone: false,
  };
}

export function currentDay(s: GameState) {
  return DAYS[s.dayIndex];
}

/** The beat list a scene phase reads from: an event chain, or the day's own. */
function beatList(s: GameState, segment: SceneSegment, chainId?: string): Beat[] {
  if (chainId) return EVENT_BEATS.find((c) => c.id === chainId)?.beats ?? [];
  return segment === 'morning' ? currentDay(s).morning : currentDay(s).evening;
}

export function currentBeat(s: GameState) {
  const phase = s.phase;
  if (phase.kind !== 'scene') return undefined;
  return beatList(s, phase.segment, phase.chainId).find((b) => b.id === phase.beatId);
}

export function currentCase(s: GameState) {
  if (s.phase.kind !== 'desk') return undefined;
  return currentDay(s).cases[s.phase.caseIndex];
}

// ---------------------------------------------------------------------------
// Cumulative rulebook
// ---------------------------------------------------------------------------

/** A rule still in force, tagged with the day it was first issued. */
export interface StandingRule {
  id: string; // id of the first issue
  ids: string[]; // every id this order has been issued under, first issue first
  text: string;
  dayIndex: number; // 0-based index of the day the order was introduced
}

/**
 * Every order in force on `dayIndex`: walks days 0..dayIndex, collects rules,
 * dedupes by normalized text (lowercase, punctuation/whitespace stripped) —
 * first occurrence wins, so a re-issued order keeps its original issue day.
 * Re-issues are recorded in `ids` so case ruleIds referencing a later-day
 * alias still match for highlighting.
 */
export function getStandingRules(dayIndex: number): StandingRule[] {
  if (dayIndex < 0) return [];
  const seen = new Map<string, StandingRule>();
  const upto = Math.min(dayIndex, DAYS.length - 1);
  for (let d = 0; d <= upto; d++) {
    for (const r of DAYS[d].rules) {
      const key = r.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const prev = seen.get(key);
      if (prev) prev.ids.push(r.id);
      else seen.set(key, { id: r.id, ids: [r.id], text: r.text, dayIndex: d });
    }
  }
  return [...seen.values()];
}

/**
 * Short ledger phrases for beats that raise suspicion without their own note
 * (keyed by beat id); anything else falls back to a generic line.
 */
const BEAT_SUSPICION_PHRASES: Record<string, string> = {
  ev_movement_raids_3: 'The night raid is written down somewhere',
  ev_watched_1_2: 'Pandurang is counting your stamps',
  ev_watched_2_3: 'The warning that is given once',
  ev_watched_3_3: 'A photograph joins the file',
};

/** Trim a ledger entry to ~60 chars so the docket lines stay one-liners. */
function logSuspicion(s: GameState, raw: string): GameState {
  const entry = raw.length > 60 ? `${raw.slice(0, 57).trimEnd()}…` : raw;
  return { ...s, suspicionLog: [...s.suspicionLog, entry].slice(-5) };
}

/** Suspicion >= 100 at any point -> arrest interstitial. */
function checkArrest(s: GameState): GameState {
  if (s.meters.suspicion >= 100 && s.phase.kind !== 'arrest' && s.phase.kind !== 'ending') {
    return {
      ...s,
      flags: s.flags.includes('arrested') ? s.flags : [...s.flags, 'arrested'],
      phase: { kind: 'arrest' },
    };
  }
  return s;
}

/**
 * Apply an Effects block: meters clamped 0-100, flag set, note logged.
 * Credibility debt: with 2+ prior flagrant acts, positive movement gains
 * are halved (rounded down). The act currently being applied, if flagrant,
 * counts toward debt only for FUTURE gains.
 */
export function applyEffects(
  s: GameState,
  fx: Effects | undefined,
  opts?: { flagrant?: boolean; trackRupees?: boolean; suspicionReason?: string },
): GameState {
  let next = s;
  if (fx) {
    const mv = fx.movement ?? 0;
    const mvAdjusted = s.credibilityDebt >= 2 && mv > 0 ? Math.floor(mv / 2) : mv;
    const rupeeDelta = typeof fx.rupees === 'number' ? fx.rupees : 0;
    next = {
      ...next,
      meters: {
        household: clamp(next.meters.household + (fx.household ?? 0)),
        crown: clamp(next.meters.crown + (fx.crown ?? 0)),
        movement: clamp(next.meters.movement + mvAdjusted),
        conscience: clamp(next.meters.conscience + (fx.conscience ?? 0)),
        suspicion: clamp(next.meters.suspicion + (fx.suspicion ?? 0)),
      },
      // immediate tin-box delta — beats and case outcomes alike
      rupees: rupeeDelta !== 0 ? next.rupees + rupeeDelta : next.rupees,
      // at-home money (beat choices / beat auto-effects) goes on the day ledger
      dayChoiceNet: opts?.trackRupees ? next.dayChoiceNet + rupeeDelta : next.dayChoiceNet,
      flags: fx.flag && !next.flags.includes(fx.flag) ? [...next.flags, fx.flag] : next.flags,
      log: fx.note ? [...next.log, fx.note] : next.log,
    };
    if ((fx.suspicion ?? 0) > 0) {
      next = logSuspicion(
        next,
        opts?.suspicionReason ?? fx.note ?? 'The file thickens',
      );
    }
  }
  if (opts?.flagrant) {
    next = { ...next, credibilityDebt: next.credibilityDebt + 1 };
  }
  return checkArrest(next);
}

/** Roll a risk: p is the probability of FAILURE. */
export function rollRisk(
  s: GameState,
  risk: Risk,
  opts?: { trackRupees?: boolean; suspicionReason?: string },
): { state: GameState; success: boolean; text: string } {
  const success = Math.random() >= risk.p;
  const state = applyEffects(s, success ? risk.onSuccess : risk.onFail, opts);
  return { state, success, text: success ? risk.successText : risk.failText };
}

/** madhavAlive = NOT (flag "madhav_dead" or "madhav_arrested"). */
export function madhavAlive(s: GameState): boolean {
  return !s.flags.includes('madhav_dead') && !s.flags.includes('madhav_arrested');
}

export function evalCondition(cond: Condition, s: GameState): boolean {
  const m = s.meters;
  if (cond.crownMin !== undefined && m.crown < cond.crownMin) return false;
  if (cond.crownMax !== undefined && m.crown > cond.crownMax) return false;
  if (cond.movementMin !== undefined && m.movement < cond.movementMin) return false;
  if (cond.movementMax !== undefined && m.movement > cond.movementMax) return false;
  if (cond.householdMin !== undefined && m.household < cond.householdMin) return false;
  if (cond.householdMax !== undefined && m.household > cond.householdMax) return false;
  if (cond.conscienceMin !== undefined && m.conscience < cond.conscienceMin) return false;
  if (cond.conscienceMax !== undefined && m.conscience > cond.conscienceMax) return false;
  if (cond.suspicionMin !== undefined && m.suspicion < cond.suspicionMin) return false;
  if (cond.suspicionMax !== undefined && m.suspicion > cond.suspicionMax) return false;
  if (cond.rupeesMin !== undefined && s.rupees < cond.rupeesMin) return false;
  if (cond.flag !== undefined && !s.flags.includes(cond.flag)) return false;
  if (cond.flagNot !== undefined && s.flags.includes(cond.flagNot)) return false;
  if (cond.madhavAlive !== undefined && madhavAlive(s) !== cond.madhavAlive) return false;
  return true;
}

/** First matching condition in ENDINGS order wins. */
export function resolveEnding(s: GameState): Ending {
  for (const e of ENDINGS) {
    if (evalCondition(e.condition, s)) return e;
  }
  return ENDINGS[ENDINGS.length - 1];
}

/** True while the Crown's favor makes the bazaar demand cash in advance. */
export function bazaarIsCold(s: GameState): boolean {
  return s.meters.crown >= 70;
}

/**
 * CSS filter classes for Keshav's portrait, driven by hidden strain:
 * gaunt when the household starves, shadowed when the file is open on him.
 */
export function keshavMoodClass(m: Meters): string {
  const gaunt = m.household < 30;
  const shadowed = m.suspicion >= 70;
  if (gaunt && shadowed) return 'keshav-gaunt keshav-shadowed';
  if (gaunt) return 'keshav-gaunt';
  if (shadowed) return 'keshav-shadowed';
  return '';
}

// ---------------------------------------------------------------------------
// Phase transitions (pure)
// ---------------------------------------------------------------------------

/**
 * dayIntro -> the first beat of the day. Before the day's own morning beats,
 * play the FIRST EVENT_BEATS chain whose `requires` matches the current state
 * and whose chain flag is not yet set. Each chain's terminal beats set that
 * flag, so a chain fires once.
 */
export function startDay(s: GameState): GameState {
  const chain = EVENT_BEATS.find((c) => !s.flags.includes(c.id) && evalCondition(c.requires, s));
  if (chain && chain.beats.length > 0) {
    return enterBeat(s, 'morning', chain.beats[0].id, chain.id);
  }
  return enterBeat(s, 'morning', currentDay(s).morning[0].id);
}

function enterBeat(s: GameState, segment: SceneSegment, beatId: string, chainId?: string): GameState {
  const list = beatList(s, segment, chainId);
  let beat = list.find((b) => b.id === beatId);
  // A beat whose `requires` fails is skipped straight to its own `next`.
  let guard = 0;
  while (beat?.requires && !evalCondition(beat.requires, s)) {
    if (!beat.next) return finishSegment(s, segment, chainId);
    beat = list.find((b) => b.id === beat!.next);
    if (++guard > 50) break; // malformed chain: never loop forever
  }
  if (!beat) return finishSegment(s, segment, chainId);
  let next: GameState = {
    ...s,
    phase: chainId
      ? { kind: 'scene', segment, beatId: beat.id, chainId }
      : { kind: 'scene', segment, beatId: beat.id },
  };
  if (beat.effects) {
    next = applyEffects(next, beat.effects, {
      trackRupees: true,
      suspicionReason: beat.effects.note
        ? undefined
        : (BEAT_SUSPICION_PHRASES[beat.id] ?? 'The file thickens'),
    });
  }
  return next;
}

/** Segment exhausted: event chain -> the day's morning beats; morning -> desk; evening -> settle. */
function finishSegment(s: GameState, segment: SceneSegment, chainId?: string): GameState {
  if (chainId) {
    return enterBeat(s, 'morning', currentDay(s).morning[0].id);
  }
  if (segment === 'morning') {
    return { ...s, phase: { kind: 'desk', caseIndex: 0 } };
  }
  // evening finished -> summary: settle the day's money, apply household cost
  const day = currentDay(s);
  // While the Crown loves you the bazaar does not: no credit, cash in advance.
  const bazaarCold = s.meters.crown >= 70;
  const cost = day.householdCost + (bazaarCold ? 2 : 0);
  const bribesToday = s.stats.bribeRupees - s.dayStart.stats.bribeRupees;
  const rupees = s.rupees + day.salary + bribesToday - cost;
  // No money left: the shortfall comes out of the household's hide.
  // Half the shortfall, rounded down, never less than 3 points — and two
  // more for every consecutive day the tin box stays empty.
  const consecutiveShortfalls = rupees < 0 ? s.consecutiveShortfalls + 1 : 0;
  const lastShortfall =
    rupees < 0 ? Math.max(3, Math.floor(-rupees / 2)) + 2 * consecutiveShortfalls : 0;
  let next = applyEffects(s, { household: -cost - lastShortfall });
  next = {
    ...next,
    rupees,
    lastShortfall,
    consecutiveShortfalls,
    phase: { kind: 'summary' },
    daysServed: next.daysServed + 1,
  };
  return checkArrest(next);
}

/** Move to a named beat, or finish the segment when next is undefined. */
export function advanceToBeat(s: GameState, nextId: string | undefined): GameState {
  if (s.phase.kind !== 'scene') return s;
  const { segment, chainId } = s.phase;
  if (nextId) return enterBeat(s, segment, nextId, chainId);
  return finishSegment(s, segment, chainId);
}

/** Advance from a no-choice beat via its own `next`. */
export function advanceBeat(s: GameState): GameState {
  const beat = currentBeat(s);
  if (!beat || beat.choices?.length) return s;
  return advanceToBeat(s, beat.next);
}

/** Apply a scene choice (effects, flagrant debt, risk roll). Does not advance. */
export function choose(
  s: GameState,
  choice: Choice,
): { state: GameState; riskText?: string; riskSuccess?: boolean } {
  let state = applyEffects(s, choice.effects, {
    flagrant: choice.flagrant === true,
    trackRupees: true,
  });
  if (!choice.risk) return { state };
  const rolled = rollRisk(state, choice.risk, { trackRupees: true });
  state = rolled.state;
  return { state, riskText: rolled.text, riskSuccess: rolled.success };
}

/** Stamp a desk case. Applies outcome effects + stats; rolls the case risk on approve. */
export function stamp(s: GameState, action: DeskAction): { state: GameState; result: StampResult } {
  const c = currentCase(s);
  if (!c || s.phase.kind !== 'desk') return { state: s, result: { outcomeText: '' } };
  // Guard: a case already stamped (e.g. reload mid-outcome) cannot be stamped twice.
  if (s.stampedCases.includes(c.id)) return { state: s, result: { outcomeText: '' } };

  const outcome = action === 'bribe' ? c.outcomes.bribe : c.outcomes[action];
  if (!outcome) return { state: s, result: { outcomeText: '' } };

  const flagrant = action === 'bribe' && c.bribe?.flagrant === true;
  let state = applyEffects(s, outcome, {
    flagrant,
    suspicionReason: `${c.entrantName} — ${outcome.note ?? 'the wrong stamp'}`,
  });

  const stats = { ...state.stats };
  if (action === 'approve') stats.approved += 1;
  else if (action === 'deny') stats.denied += 1;
  else if (action === 'detain') stats.detained += 1;
  else {
    stats.bribes += 1;
    stats.approved += 1; // a bribed stamp still stamps them through
    stats.bribeRupees += c.bribe?.amount ?? 0;
  }
  state = { ...state, stats, stampedCases: [...state.stampedCases, c.id] };

  const result: StampResult = {
    outcomeText: outcome.text,
    moralWeight: !!(outcome.note || outcome.flag),
  };

  // DocCase.risk attaches to the riskiest resolution: approving.
  if (action === 'approve' && c.risk) {
    const rolled = rollRisk(state, c.risk, {
      suspicionReason: `${c.entrantName} — ${c.risk.onFail.note ?? 'it came apart'}`,
    });
    state = rolled.state;
    result.riskText = rolled.text;
    result.riskSuccess = rolled.success;
  }

  return { state, result };
}

/** Next entrant, or end the desk shift into the evening scene. */
export function nextCase(s: GameState): GameState {
  if (s.phase.kind !== 'desk') return s;
  const day = currentDay(s);
  const nextIndex = s.phase.caseIndex + 1;
  if (nextIndex < day.cases.length) {
    return { ...s, phase: { kind: 'desk', caseIndex: nextIndex } };
  }
  return enterBeat(s, 'evening', day.evening[0].id);
}

/** Summary -> next day intro, or ending resolution after the last day. */
export function sleep(s: GameState): GameState {
  if (s.phase.kind !== 'summary') return s;
  if (s.dayIndex >= DAYS.length - 1) {
    const ending = resolveEnding(s);
    return { ...s, phase: { kind: 'ending', endingId: ending.id } };
  }
  const dayIndex = s.dayIndex + 1;
  return {
    ...s,
    dayIndex,
    phase: { kind: 'dayIntro' },
    lastShortfall: 0,
    dayChoiceNet: 0,
    dayStart: { meters: { ...s.meters }, stats: { ...s.stats } },
  };
}

/** Arrest interstitial -> the "Taken In" ending. */
export function arrestContinue(s: GameState): GameState {
  const ending = resolveEnding(s); // 'taken_in' is first in ENDINGS order
  return { ...s, phase: { kind: 'ending', endingId: ending.id } };
}

export function markRulebookSeen(s: GameState): GameState {
  return { ...s, rulebookSeenDay: s.dayIndex };
}

export function markTutorialDone(s: GameState): GameState {
  return { ...s, tutorialDone: true };
}

export function isChoiceAvailable(s: GameState, choice: Choice): boolean {
  return !choice.requires || evalCondition(choice.requires, s);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export function saveRun(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable */
  }
}

export function loadRun(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (typeof parsed.dayIndex !== 'number' || !parsed.phase) return null;
    if (parsed.dayIndex < 0 || parsed.dayIndex >= DAYS.length) return null;
    // normalize saves from before bribeRupees existed
    if (parsed.stats && typeof parsed.stats.bribeRupees !== 'number') parsed.stats.bribeRupees = 0;
    if (parsed.dayStart?.stats && typeof parsed.dayStart.stats.bribeRupees !== 'number') {
      parsed.dayStart.stats.bribeRupees = 0;
    }
    // normalize saves missing newer top-level fields
    if (typeof parsed.credibilityDebt !== 'number') parsed.credibilityDebt = 0;
    if (typeof parsed.rulebookSeenDay !== 'number') parsed.rulebookSeenDay = -1;
    if (typeof parsed.rupees !== 'number') parsed.rupees = 0;
    if (typeof parsed.lastShortfall !== 'number') parsed.lastShortfall = 0;
    if (typeof parsed.consecutiveShortfalls !== 'number') parsed.consecutiveShortfalls = 0;
    if (typeof parsed.dayChoiceNet !== 'number') parsed.dayChoiceNet = 0;
    if (!Array.isArray(parsed.flags)) parsed.flags = [];
    if (!Array.isArray(parsed.log)) parsed.log = [];
    if (!Array.isArray(parsed.stampedCases)) parsed.stampedCases = [];
    if (!Array.isArray(parsed.suspicionLog)) parsed.suspicionLog = [];
    if (typeof parsed.tutorialDone !== 'boolean') parsed.tutorialDone = false;
    return parsed;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export interface GameApi {
  run: GameState | null;
  hasSave: boolean;
  newGame: () => void;
  continueGame: () => void;
  abandon: () => void;
  startDay: () => void;
  advanceBeat: () => void;
  advanceToBeat: (nextId: string | undefined) => void;
  choose: (choice: Choice) => { riskText?: string; riskSuccess?: boolean };
  stamp: (action: DeskAction) => StampResult;
  nextCase: () => void;
  sleep: () => void;
  arrestContinue: () => void;
  markRulebookSeen: () => void;
  markTutorialDone: () => void;
  /** Load an arbitrary pre-built state (debug/god-mode jumps; see game/godmode.ts). */
  debugStart: (state: GameState) => void;
}

export function useGame(): GameApi {
  const [run, setRun] = useState<GameState | null>(null);
  const [hasSave, setHasSave] = useState<boolean>(() => loadRun() !== null);

  useEffect(() => {
    if (run) {
      saveRun(run);
      setHasSave(true);
    }
  }, [run]);

  const mutate = useCallback((fn: (s: GameState) => GameState) => {
    setRun((prev) => (prev ? fn(prev) : prev));
  }, []);

  const newGame = useCallback(() => {
    setRun(initialState());
  }, []);

  const continueGame = useCallback(() => {
    const loaded = loadRun();
    if (loaded) setRun(loaded);
  }, []);

  const abandon = useCallback(() => {
    clearRun();
    setRun(null);
    setHasSave(false);
  }, []);

  const chooseCb = useCallback((choice: Choice) => {
    let out: { riskText?: string; riskSuccess?: boolean } = {};
    setRun((prev) => {
      if (!prev) return prev;
      const r = choose(prev, choice);
      out = { riskText: r.riskText, riskSuccess: r.riskSuccess };
      return r.state;
    });
    return out;
  }, []);

  const stampCb = useCallback((action: DeskAction): StampResult => {
    let result: StampResult = { outcomeText: '' };
    setRun((prev) => {
      if (!prev) return prev;
      const r = stamp(prev, action);
      result = r.result;
      return r.state;
    });
    return result;
  }, []);

  return {
    run,
    hasSave,
    newGame,
    continueGame,
    abandon,
    startDay: () => mutate(startDay),
    advanceBeat: () => mutate(advanceBeat),
    advanceToBeat: (nextId) => mutate((s) => advanceToBeat(s, nextId)),
    choose: chooseCb,
    stamp: stampCb,
    nextCase: () => mutate(nextCase),
    sleep: () => mutate(sleep),
    arrestContinue: () => mutate(arrestContinue),
    markRulebookSeen: () => mutate(markRulebookSeen),
    markTutorialDone: () => mutate(markTutorialDone),
    debugStart: (state: GameState) => setRun(state),
  };
}
