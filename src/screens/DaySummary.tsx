import { useEffect } from 'react';
import { KeyHint, PixelButton } from '../components/Chrome';
import { isTypingTarget } from '../lib/utils';
import type { GameState } from '../game/engine';
import { bazaarIsCold, currentDay, keshavMoodClass } from '../game/engine';

interface DaySummaryProps {
  run: GameState;
  onSleep: () => void;
}

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-[#6E7278]">±0</span>;
  return value > 0 ? (
    <span className="text-[#B9A576]">+{value}</span>
  ) : (
    <span className="text-[#c05a54]">−{Math.abs(value)}</span>
  );
}

/** Escalating strain lines for households in persistent debt (index 0 = 2nd shortfall). */
const SHORTFALL_STRAIN = [
  'The rice jar is empty again. Radha thins the dal until it is soup.',
  'The second week of empty rice jars. The children have stopped asking.',
  'There is nothing left to pawn but the tin box itself.',
];

function LedgerRow({ label, paise, tone }: { label: string; paise: string; tone: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-[#6E7278]/60 pb-1">
      <span className="font-pixel text-[9px] tracking-widest uppercase">{label}</span>
      <span className={`font-vt text-3xl font-bold ${tone}`}>{paise}</span>
    </div>
  );
}

/** Ledger-style end-of-day summary: stamp counts, rupee entries, meter deltas. */
export function DaySummary({ run, onSleep }: DaySummaryProps) {
  const day = currentDay(run);

  // Enter/Space = sleep.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'enter' || k === ' ') {
        e.preventDefault();
        onSleep();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSleep]);

  const dStats = {
    approved: run.stats.approved - run.dayStart.stats.approved,
    denied: run.stats.denied - run.dayStart.stats.denied,
    detained: run.stats.detained - run.dayStart.stats.detained,
    bribes: run.stats.bribes - run.dayStart.stats.bribes,
    bribeRupees: run.stats.bribeRupees - run.dayStart.stats.bribeRupees,
  };
  const dMeters = {
    household: run.meters.household - run.dayStart.meters.household,
    crown: run.meters.crown - run.dayStart.meters.crown,
    movement: run.meters.movement - run.dayStart.meters.movement,
  };
  // Crown >= 70 at settle: the bazaar demanded cash in advance (+₹2).
  const bazaarCold = bazaarIsCold(run);
  const netRupees =
    day.salary + dStats.bribeRupees + run.dayChoiceNet - day.householdCost - (bazaarCold ? 2 : 0);
  const summary = day.summaryText.replace('{cost}', String(day.householdCost));

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#1a2430] px-4 py-8 md:py-16">
      <div className="w-full max-w-2xl">
        <div className="torn-top" />
        <div className="hard fade-in bg-[#D8C7A1] p-6 text-[#1a2430] md:p-8">
          <div className="text-center">
            <span className="font-pixel text-[10px] tracking-widest text-[#8C2F2B]">DAY LEDGER</span>
            <div className="mt-1 font-pixel text-[7px] tracking-widest text-[#6E7278]">
              SHIFT 9:00 – 18:00
            </div>
            <div className="mt-2 flex items-center justify-center gap-3">
              <img
                src="/bust_keshav.png"
                alt="Keshav"
                className={`pixel-img h-14 w-14 border-2 border-[#1a2430] object-cover sepia ${keshavMoodClass(run.meters)}`}
              />
              <h2 className="font-vt text-4xl">{day.date} — {day.title}</h2>
            </div>
          </div>
          <div className="my-4 border-t-4 border-[#1a2430]" />

          <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-vt text-2xl md:grid-cols-4">
            <div>Approved: <span className="font-bold">{dStats.approved}</span></div>
            <div>Denied: <span className="font-bold">{dStats.denied}</span></div>
            <div>Detained: <span className="font-bold">{dStats.detained}</span></div>
            <div>Bribes: <span className="font-bold">{dStats.bribes}</span></div>
          </div>

          <div className="my-4 border-t-2 border-dashed border-[#6E7278]" />

          {/* rupee ledger — salary, bribes, household, running total */}
          <div className="space-y-1 font-vt">
            <LedgerRow label="Salary" paise={`+₹${day.salary}`} tone="text-[#2B3A4A]" />
            {dStats.bribeRupees > 0 && (
              <LedgerRow
                label={`Bribes taken${dStats.bribes > 1 ? ` ×${dStats.bribes}` : ''}`}
                paise={`+₹${dStats.bribeRupees}`}
                tone="text-[#9C7A3C]"
              />
            )}
            {run.dayChoiceNet !== 0 && (
              <LedgerRow
                label="At home"
                paise={`${run.dayChoiceNet < 0 ? '−' : '+'}₹${Math.abs(run.dayChoiceNet)}`}
                tone={run.dayChoiceNet < 0 ? 'text-[#8C2F2B]' : 'text-[#5A7048]'}
              />
            )}
            <LedgerRow label="Household expenses" paise={`−₹${day.householdCost}`} tone="text-[#8C2F2B]" />
            {bazaarCold && (
              <LedgerRow label="No credit at the bazaar" paise="−₹2" tone="text-[#8C2F2B]" />
            )}
            {/* red pencil day net */}
            <div
              className="mt-2 flex items-baseline justify-between gap-4 border-t-4 border-[#8C2F2B] pt-1"
              style={{ transform: 'rotate(-0.4deg)' }}
            >
              <span className="font-pixel text-[9px] tracking-widest text-[#8C2F2B] uppercase">
                Day total
              </span>
              <span className="font-vt text-3xl font-bold text-[#8C2F2B]">
                {netRupees >= 0 ? '+' : '−'}₹{Math.abs(netRupees)}
              </span>
            </div>
            {/* running total — red pencil when the household is in debt */}
            <div className="flex items-baseline justify-between gap-4 pt-1">
              <span className="font-pixel text-[9px] tracking-widest uppercase">
                In the tin box
              </span>
              <span
                className={`font-vt text-3xl font-bold ${run.rupees < 0 ? 'text-[#8C2F2B]' : 'text-[#2B3A4A]'}`}
                style={run.rupees < 0 ? { transform: 'rotate(-0.6deg)' } : undefined}
              >
                {run.rupees < 0 ? '−' : ''}₹{Math.abs(run.rupees)}
              </span>
            </div>
            {run.lastShortfall > 0 && (
              <p className="pt-1 font-vt text-xl leading-snug text-[#8C2F2B] italic">
                {run.consecutiveShortfalls >= 2
                  ? SHORTFALL_STRAIN[
                      Math.min(run.consecutiveShortfalls - 2, SHORTFALL_STRAIN.length - 1)
                    ]
                  : "The moneylender's boy came by twice."}{' '}
                (Household −{run.lastShortfall})
              </p>
            )}
          </div>

          <div className="my-4 border-t-2 border-dashed border-[#6E7278]" />

          <div className="space-y-1 font-vt text-2xl">
            <div className="flex justify-between">
              <span>Household</span>
              <Delta value={dMeters.household} />
            </div>
            <div className="flex justify-between">
              <span>Crown standing</span>
              <Delta value={dMeters.crown} />
            </div>
            <div className="flex justify-between">
              <span>Movement sympathy</span>
              <Delta value={dMeters.movement} />
            </div>
          </div>

          <div className="my-4 border-t-2 border-dashed border-[#6E7278]" />
          <p className="font-vt text-xl leading-snug text-[#2B3A4A] italic">{summary}</p>

          <div className="mt-6 flex justify-end">
            <PixelButton pixel color="indigo" onClick={onSleep} className="min-h-11">
              SLEEP
              <KeyHint k="⏎" />
            </PixelButton>
          </div>
        </div>
        <div className="torn-bottom" />
      </div>
    </div>
  );
}
