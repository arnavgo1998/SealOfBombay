// Node/tsx assertions for fix-7. Run: tsx scripts/assert-fix7.ts
// Not part of the build; exits non-zero on the first failure summary.
import {
  applyEffects,
  advanceBeat,
  advanceToBeat,
  currentBeat,
  initialState,
  startDay,
  stamp,
} from '../src/game/engine';
import type { GameState } from '../src/game/engine';
import { DAYS, EVENT_BEATS } from '../src/game/script';
import { assignBusts } from '../src/game/entrants';

let failures = 0;
function ok(cond: boolean, label: string) {
  if (cond) console.log(`  ok  ${label}`);
  else {
    failures++;
    console.error(`FAIL  ${label}`);
  }
}

const at = (s: GameState, patch: Partial<GameState>): GameState => ({ ...s, ...patch });
const withMeters = (s: GameState, m: Partial<GameState['meters']>): GameState =>
  at(s, { meters: { ...s.meters, ...m } });

// ---------------------------------------------------------------------------
console.log('1. event chain fires at threshold, not before, and once');
// ---------------------------------------------------------------------------
{
  const base = initialState();
  // below the watched_1 threshold (45): no chain
  let s = startDay(withMeters(base, { suspicion: 44 }));
  ok(s.phase.kind === 'scene' && s.phase.beatId === DAYS[0].morning[0].id && !('chainId' in s.phase && s.phase.chainId), 'suspicion 44 -> plain morning beat');

  // at threshold: watched_1 chain plays first
  s = startDay(withMeters(base, { suspicion: 45 }));
  ok(s.phase.kind === 'scene' && s.phase.chainId === 'watched_1' && s.phase.beatId === 'ev_watched_1_1', 'suspicion 45 -> watched_1 chain opens the day');

  // walk the chain to its end; the terminal beat sets the flag
  s = advanceBeat(s); // -> ev_watched_1_2 (applies flag watched_1)
  ok(s.phase.kind === 'scene' && s.phase.beatId === 'ev_watched_1_2', 'chain advances within itself');
  ok(s.flags.includes('watched_1'), 'terminal beat set the chain flag');
  s = advanceBeat(s); // chain exhausted -> the day's own morning beats
  ok(s.phase.kind === 'scene' && s.phase.chainId === undefined && s.phase.beatId === DAYS[0].morning[0].id, 'chain end falls through to morning beats');

  // a later day with the flag set and suspicion still >= 45: never fires again
  const again = startDay(at(withMeters(base, { suspicion: 60 }), { dayIndex: 1, flags: ['watched_1'] }));
  ok(again.phase.kind === 'scene' && again.phase.chainId === undefined, 'chain does not fire twice');

  // a higher chain pre-empts: suspicion 90 with no flags -> watched_3 (listed before watched_2/1? no: leela_worst first, then watched_3)
  const urgent = startDay(withMeters(base, { suspicion: 90 }));
  ok(urgent.phase.kind === 'scene' && urgent.phase.chainId === 'watched_3', 'most urgent matching chain wins (watched_3 at 90)');
}

// ---------------------------------------------------------------------------
console.log('2. Beat.requires: unmet condition skips the beat to its next');
// ---------------------------------------------------------------------------
{
  // Inject a synthetic chain whose middle beat requires a flag we do not have.
  EVENT_BEATS.push({
    id: 'test_skip',
    requires: { flagNot: 'test_skip' },
    beats: [
      { id: 'test_skip_1', bg: 'office', speaker: 'Narrator', text: 'one', next: 'test_skip_2' },
      {
        id: 'test_skip_2',
        bg: 'office',
        speaker: 'Narrator',
        text: 'two (skipped)',
        requires: { flag: 'never_set' },
        next: 'test_skip_3',
        effects: { crown: 50 }, // must NOT apply
      },
      { id: 'test_skip_3', bg: 'office', speaker: 'Narrator', text: 'three', effects: { flag: 'test_skip' } },
    ],
  });
  try {
    let s = startDay(initialState()); // test_skip is last; earlier chains don't match a fresh state
    ok(s.phase.kind === 'scene' && s.phase.chainId === 'test_skip' && s.phase.beatId === 'test_skip_1', 'synthetic chain opens');
    s = advanceBeat(s); // 1 -> 2 (requires unmet) -> 3
    ok(s.phase.kind === 'scene' && s.phase.beatId === 'test_skip_3', 'beat with unmet requires skipped to its next');
    ok(s.meters.crown === 50, 'skipped beat effects were not applied');
    ok(s.flags.includes('test_skip'), 'landed beat effects applied');

    // and when the condition IS met, the beat shows
    let s2 = startDay(at(initialState(), { flags: ['never_set'] }));
    // earlier chains still don't match; test_skip's flagNot is unset on this fresh copy
    s2 = advanceBeat(s2);
    ok(s2.phase.kind === 'scene' && s2.phase.beatId === 'test_skip_2' && s2.meters.crown === 100, 'beat shown (and effects applied) when requires met');
  } finally {
    EVENT_BEATS.pop();
  }
}

// ---------------------------------------------------------------------------
console.log('3. community_cold: +2 household cost only when crown >= 70');
// ---------------------------------------------------------------------------
{
  const settle = (crown: number) => {
    // park the state on the last evening beat of day 0, then advance past it
    let s = startDay(initialState());
    // walk morning beats to the desk, then evening
    while (s.phase.kind === 'scene') s = advanceBeat(s);
    while (s.phase.kind === 'desk') {
      const r = stamp(s, 'approve');
      s = r.state;
      if (s.phase.kind === 'desk') {
        s = { ...s, phase: { kind: 'desk', caseIndex: s.phase.caseIndex + 1 } };
        if (s.phase.caseIndex >= DAYS[0].cases.length) {
          // enter evening manually
          s = { ...s, phase: { kind: 'scene', segment: 'evening', beatId: DAYS[0].evening[0].id } };
        }
      }
    }
    while (s.phase.kind === 'scene') s = advanceBeat(s);
    return s;
  };
  // note: stamping through day 1 changes meters; instead drive settle directly:
  const directSettle = (crown: number) => {
    const day = DAYS[0];
    let s = withMeters(initialState(), { crown });
    s = at(s, { phase: { kind: 'scene', segment: 'evening', beatId: day.evening[day.evening.length - 1].id } });
    const before = s;
    const out = advanceToBeat(s, undefined);
    return { out, before };
  };
  const day = DAYS[0];
  const warm = directSettle(69);
  ok(warm.out.phase.kind === 'summary', 'evening end -> summary (crown 69)');
  ok(warm.out.rupees === day.salary - day.householdCost, 'crown 69: no bazaar surcharge');
  const cold = directSettle(70);
  ok(cold.out.rupees === day.salary - day.householdCost - 2, 'crown 70: -2 surcharge in the tin box');
  ok(
    cold.out.meters.household === 60 - day.householdCost - 2 - (cold.out.rupees < 0 ? cold.out.lastShortfall : 0),
    'crown 70: household absorbs cost + 2',
  );
  void settle; // (kept for manual debugging)
}

// ---------------------------------------------------------------------------
console.log('4. suspicionLog: records reasons, caps at 5, trims to ~60');
// ---------------------------------------------------------------------------
{
  let s = initialState();
  for (let i = 0; i < 7; i++) {
    s = applyEffects(s, { suspicion: 3 }, { suspicionReason: `Reason number ${i} — a long trailing explanation that will definitely exceed sixty characters total` });
  }
  ok(s.suspicionLog.length === 5, 'log capped at 5');
  ok(s.suspicionLog.every((e) => e.length <= 60), 'entries trimmed to ~60 chars');
  ok(s.suspicionLog[4].startsWith('Reason number 6'), 'keeps the MOST RECENT reasons');

  // case outcomes log "Name — note"
  const withCase = at(withMeters(initialState(), {}), {
    phase: { kind: 'desk', caseIndex: 0 },
  });
  const day1 = DAYS[0];
  const susCaseIdx = day1.cases.findIndex((c) =>
    (['approve', 'deny', 'detain'] as const).some((a) => (c.outcomes[a].suspicion ?? 0) > 0),
  );
  if (susCaseIdx >= 0) {
    const action = (['approve', 'deny', 'detain'] as const).find(
      (a) => (day1.cases[susCaseIdx].outcomes[a].suspicion ?? 0) > 0,
    )!;
    const r = stamp(at(withCase, { phase: { kind: 'desk', caseIndex: susCaseIdx } }), action);
    ok(
      r.state.suspicionLog.length > 0 && r.state.suspicionLog[0].startsWith(`${day1.cases[susCaseIdx].entrantName} — `),
      `case suspicion logged as "Name — reason" (${day1.cases[susCaseIdx].entrantName})`,
    );
  } else {
    console.log('  ..  no day-1 case with suspicion outcome; format covered via applyEffects path');
  }

  // beat without note uses the phrase map / fallback
  const beatState = startDay(withMeters(initialState(), { movement: 75 }));
  ok(beatState.phase.chainId === 'movement_raids', 'movement 75 -> movement_raids chain');
  let b = advanceBeat(beatState);
  b = advanceBeat(b); // terminal beat has suspicion: 8, no note
  ok(
    b.suspicionLog.some((e) => e.includes('night raid')),
    'beat suspicion logs the beat phrase when no note exists',
  );
}

// ---------------------------------------------------------------------------
console.log('5. assignBusts: no adjacent repeats, <=2 per bust, all 12 days');
// ---------------------------------------------------------------------------
{
  let covered = 0;
  let total = 0;
  for (let d = 0; d < DAYS.length; d++) {
    const day = DAYS[d];
    const ids = day.cases.map((c) => c.id);
    const busts = assignBusts(ids, d);
    // effective rendered sequence (story busts win for portrait cases)
    const effective = day.cases.map((c, i) => c.entrantPortrait ?? busts[i]);
    for (let i = 1; i < effective.length; i++) {
      if (effective[i] === effective[i - 1]) {
        failures++;
        console.error(`FAIL  day ${d + 1}: adjacent repeat ${effective[i]} at cases ${i}/${i + 1}`);
      }
    }
    const counts = new Map<string, number>();
    for (const b of effective) counts.set(b, (counts.get(b) ?? 0) + 1);
    for (const [b, n] of counts) {
      if (n > 2) {
        failures++;
        console.error(`FAIL  day ${d + 1}: ${b} appears ${n} times`);
      }
    }
    // stability across calls
    const again = assignBusts(ids, d);
    ok(JSON.stringify(again) === JSON.stringify(busts), `day ${d + 1}: assignment deterministic`);
  }
  ok(true, 'no adjacent duplicates and <=2 repeats per day (details above)');
  void covered; void total;
}

// ---------------------------------------------------------------------------
console.log('6. weather / sfx markers read correctly');
// ---------------------------------------------------------------------------
{
  ok(DAYS[5].weather === 'rain', 'day 6 (index 5) is rain');
  ok(DAYS[6].sfx === 'blast', 'day 7 (index 6) carries the blast');
  ok(DAYS[7].weather === 'rain', 'day 8 (index 7) is rain');
}

console.log(failures === 0 ? '\nALL ASSERTIONS PASSED' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
