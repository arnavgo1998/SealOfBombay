import { useState } from 'react';
import type { StandingRule } from '../game/engine';

interface RulebookProps {
  date: string;
  /** Today's freshly issued orders. */
  newRules: StandingRule[];
  /** Orders carried over from previous days (still in force). */
  standingRules: StandingRule[];
  highlightIds?: string[];
  /** Bomanji's shift-start briefing line; rendered above the rules when set. */
  briefingLine?: string | null;
  /** Day 1: the briefing carries the WHAT TO CHECK micro-list. */
  showTutorial?: boolean;
  /** Dismisses the briefing AND the rulebook together (the "TO WORK" button). */
  onBriefingDismiss?: () => void;
  onClose?: () => void;
}

/** Small CSS date chip: a calendar square with a day number. */
function DateChipGlyph() {
  return (
    <span className="flex h-5 w-5 flex-col border-2 border-[#2B3A4A] bg-[#D8C7A1]">
      <span className="h-[4px] w-full bg-[#8C2F2B]" />
      <span className="flex flex-1 items-center justify-center font-vt text-[11px] leading-none text-[#2B3A4A]">
        31
      </span>
    </span>
  );
}

/** Small CSS map-pin glyph: brass diamond with an ink center. */
function MapPinGlyph() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center">
      <span className="h-[13px] w-[13px] rotate-45 border-2 border-[#2B3A4A] bg-[#9C7A3C]" />
      <span className="absolute h-[4px] w-[4px] bg-[#1a2430]" />
    </span>
  );
}

/** Small CSS warning triangle with an exclamation mark. */
function WarningGlyph() {
  return (
    <span className="relative flex h-5 w-5 items-end justify-center">
      <span
        className="h-0 w-0 border-y-0 border-r-[9px] border-b-[16px] border-l-[9px] border-r-transparent border-b-[#8C2F2B] border-l-transparent"
        style={{ borderTop: 'none' }}
      />
      <span className="absolute bottom-[1px] font-vt text-[11px] leading-none text-[#D8C7A1]">!</span>
    </span>
  );
}

/** Small CSS crate glyph: bordered square with an X. */
function CrateGlyph() {
  return (
    <span className="relative flex h-5 w-5 items-center justify-center border-2 border-[#2B3A4A] bg-[#B9A576]">
      <span className="absolute h-[2px] w-[14px] rotate-45 bg-[#2B3A4A]" />
      <span className="absolute h-[2px] w-[14px] -rotate-45 bg-[#2B3A4A]" />
    </span>
  );
}

/** Tiny leading visual cue for a rule, keyed by keyword on the rule text. */
function RuleGlyph({ text }: { text: string }) {
  const s = text.toLowerCase();
  if (s.includes('seal')) {
    return <img src="/seal_valid.png" alt="" className="pixel-img h-5 w-5 object-contain" />;
  }
  if (s.includes('ward') || s.includes('zone') || s.includes('limits')) {
    return <MapPinGlyph />;
  }
  if (
    s.includes('valid') ||
    s.includes('expiry') ||
    s.includes('date') ||
    s.includes('expire')
  ) {
    return <DateChipGlyph />;
  }
  if (
    s.includes('detain') ||
    s.includes('pamphlet') ||
    s.includes('seditious') ||
    s.includes('movement') ||
    s.includes('leaflet')
  ) {
    return <WarningGlyph />;
  }
  if (
    s.includes('cargo') ||
    s.includes('goods') ||
    s.includes('manifest') ||
    s.includes('licence')
  ) {
    return <CrateGlyph />;
  }
  return <span className="mt-1 h-2 w-2 shrink-0 bg-[#8C2F2B]" />;
}

/** A stamped section header: brass for NEW ORDERS, grey for STANDING ORDERS. */
function SectionStamp({ label, brass, badge }: { label: string; brass?: boolean; badge?: string }) {
  return (
    <div
      className={`inline-flex items-center gap-2 border-[3px] px-2 py-0.5 ${brass ? 'border-[#9C7A3C]' : 'border-[#6E7278]'}`}
      style={{ transform: 'rotate(-1.2deg)' }}
    >
      <span
        className={`font-pixel text-[8px] tracking-widest ${brass ? 'text-[#9C7A3C]' : 'text-[#6E7278]'}`}
      >
        {label}
      </span>
      {badge && (
        <span className="bg-[#8C2F2B] px-1.5 py-0.5 font-pixel text-[7px] leading-none tracking-widest text-[#D8C7A1]">
          {badge}
        </span>
      )}
    </div>
  );
}

/** A rule's first sentence, short enough to wear as a chip. */
function ruleShort(text: string): string {
  const sentence = text.split('.')[0];
  return sentence.length > 58 ? `${sentence.slice(0, 55).trimEnd()}…` : sentence;
}

/** Day-one desk craft: what to actually compare on the papers. */
const FIRST_DAY_CHECKS = [
  'Name spelling across papers',
  'Dates vs today',
  'Seal vs the reference impression',
  'Ward vs permit',
];

interface BriefingCardProps {
  line: string;
  /** Today's freshly issued orders, listed as stamped chips under the line. */
  newRules: StandingRule[];
  /** Day 1: add the WHAT TO CHECK micro-list and the rulebook pointer. */
  showTutorial?: boolean;
  /** "TO WORK" — dismiss the briefing. */
  onDismiss?: () => void;
  /** Mobile modal only: "OPEN RULEBOOK" — closes the modal, opens the drawer. */
  onOpenRulebook?: () => void;
}

/**
 * Bomanji's shift-start briefing: his line, today's new orders as stamped
 * chips, and on the first day a WHAT TO CHECK micro-list. Rendered inline
 * above the rulebook on desktop and as a modal over the desk on mobile.
 */
export function BriefingCard({
  line,
  newRules,
  showTutorial = false,
  onDismiss,
  onOpenRulebook,
}: BriefingCardProps) {
  return (
    <div className="hard mb-3 flex items-start gap-3 bg-[#2B3A4A] p-3">
      <img
        src="/bust_bomanji.png"
        alt="Bomanji"
        className="pixel-img h-16 w-16 shrink-0 border-2 border-[#1a2430] object-cover sepia"
      />
      <div className="min-w-0 flex-1">
        <span className="hard-sm inline-block bg-[#9C7A3C] px-2 py-0.5 font-pixel text-[7px] tracking-widest text-[#1a2430] uppercase">
          Bomanji, deskmate
        </span>
        <p className="mt-1.5 font-vt text-xl leading-snug text-[#D8C7A1]">{line}</p>

        {/* today's new orders, telegraphed as stamped chips — or the word
            that the morning post brought nothing */}
        {newRules.length === 0 ? (
          <p className="mt-2 font-vt text-lg leading-tight text-[#6E7278] italic">
            No new orders today. The old ones stand.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap items-start gap-1.5">
            {newRules.map((r) => (
              <li
                key={r.id}
                className="border-2 border-[#8C2F2B] bg-[#D8C7A1] px-1.5 py-0.5 font-vt text-base leading-tight text-[#8C2F2B]"
                style={{ transform: 'rotate(-0.6deg)' }}
                title={r.text}
              >
                NEW: {ruleShort(r.text)}
              </li>
            ))}
          </ul>
        )}

        {showTutorial && (
          <div className="mt-2 border-t-2 border-dashed border-[#6E7278]/60 pt-2">
            <div className="font-pixel text-[7px] tracking-widest text-[#9C7A3C] uppercase">
              What to check
            </div>
            <p className="font-vt text-lg leading-snug text-[#B9A576]">
              {FIRST_DAY_CHECKS.join(' · ')}
            </p>
            <p className="font-vt text-lg leading-snug text-[#6E7278] italic">
              The rulebook is always beside your desk.
            </p>
          </div>
        )}

        {(onOpenRulebook || onDismiss) && (
          /* sticky against the card's bottom padding: when the briefing is
             taller than its scrollport (mobile modal), the way out stays
             pinned to the visible bottom edge instead of scrolling away */
          <div className="sticky bottom-0 z-10 -mx-3 mt-2 bg-[#2B3A4A] px-3 pt-2 -mb-3 pb-3">
            <p className="mb-1.5 text-center font-vt text-lg leading-none text-[#B9A576] italic">
              Bomanji waits. The queue doesn't.
            </p>
            <div className={`flex gap-2 ${onOpenRulebook ? 'flex-col' : ''}`}>
              {onOpenRulebook && (
                <button
                  type="button"
                  onClick={onOpenRulebook}
                  className="hard-sm btn-press min-h-11 w-full bg-[#D8C7A1] px-3 py-1 font-pixel text-[9px] tracking-widest text-[#1a2430]"
                >
                  OPEN RULEBOOK
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="hard btn-press cta-glow min-h-14 w-full bg-[#9C7A3C] px-3 py-2 font-pixel text-[11px] tracking-widest text-[#1a2430]"
                >
                  TO WORK <span className="blink">▸</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Sepia "ORDERS OF THE DAY" panel with torn-paper zigzag edges. The rulebook
 * is cumulative: today's freshly issued orders sit under a brass NEW ORDERS
 * stamp; everything from earlier days stands under a dimmed STANDING ORDERS
 * stamp. Rules referenced by the active case are highlighted in brass.
 */
export function Rulebook({
  date,
  newRules,
  standingRules,
  highlightIds = [],
  briefingLine,
  showTutorial = false,
  onBriefingDismiss,
  onClose,
}: RulebookProps) {
  // STANDING ORDERS start collapsed — the wall of old orders pushed today's
  // news (and the briefing's way out) below the fold on small screens.
  const [standingOpen, setStandingOpen] = useState(false);

  // The genuine-seal reference impression is printed once, beside the first
  // rule that mentions seals — it is the comparison standard for the desk.
  const sealInNew = newRules.findIndex((r) => r.text.toLowerCase().includes('seal'));
  const sealInStanding =
    sealInNew === -1 ? standingRules.findIndex((r) => r.text.toLowerCase().includes('seal')) : -1;

  // Standing orders the ACTIVE case cites ride above the fold in their own
  // strip, so a collapsed standing section never hides a rule in play.
  const relevantStanding = standingRules
    .map((r, i) => ({ r, n: i + 1 }))
    .filter(({ r }) => r.ids.some((id) => highlightIds.includes(id)));

  const renderRule = (r: StandingRule, i: number, section: 'new' | 'standing') => {
    // A case may reference a later-day re-issue id; match via all known ids.
    const hot = r.ids.some((id) => highlightIds.includes(id));
    const showSealRef = section === 'new' ? i === sealInNew : i === sealInStanding;
    const standing = section === 'standing';
    return (
      <li
        key={r.id}
        className={`flex items-start gap-2 font-vt leading-tight ${
          standing ? 'text-lg' : 'text-xl'
        } ${hot ? 'bg-[#9C7A3C] px-1 text-[#1a2430]' : standing ? 'text-[#2B3A4A]/75' : 'text-[#2B3A4A]'}`}
      >
        <span className={`mt-0.5 flex w-5 shrink-0 justify-center ${standing ? 'opacity-75' : ''}`}>
          <RuleGlyph text={r.text} />
        </span>
        <span>
          <span className={standing ? 'text-[#8C2F2B]/75' : 'text-[#8C2F2B]'}>{i + 1}.</span> {r.text}
          {showSealRef && (
            <span className="mt-1 flex items-center gap-2 border-2 border-dashed border-[#6E7278] bg-[#B9A576]/40 px-2 py-1">
              <img
                src="/seal_valid.png"
                alt="Genuine seal reference impression"
                className="pixel-img h-16 w-16 shrink-0 object-contain"
              />
              <span className="font-pixel text-[7px] leading-relaxed tracking-widest text-[#8C2F2B] uppercase">
                Seals must match this impression
              </span>
            </span>
          )}
        </span>
      </li>
    );
  };

  return (
    <div className="w-full">
      {/* Bomanji's helping-hand briefing — rides above the orders at shift start */}
      {briefingLine && (
        <BriefingCard
          line={briefingLine}
          newRules={newRules}
          showTutorial={showTutorial}
          onDismiss={onBriefingDismiss}
        />
      )}

      <div className="torn-top" />
      <div className="hard relative bg-[#D8C7A1] px-4 py-4 text-[#1a2430]" style={{ borderLeft: '4px solid #1a2430', borderRight: '4px solid #1a2430' }}>
        {/* stamp mark */}
        <div className="mb-3 border-4 border-[#8C2F2B] px-2 py-1 text-center" style={{ transform: 'rotate(-2deg)' }}>
          <span className="font-pixel text-[10px] tracking-widest text-[#8C2F2B]">ORDERS OF THE DAY</span>
          <div className="font-vt text-lg leading-none text-[#8C2F2B]">{date}</div>
        </div>

        {/* today's freshly issued orders */}
        <div className="mb-2">
          <SectionStamp
            label="New orders"
            brass
            badge={newRules.length > 0 ? `${newRules.length} NEW` : undefined}
          />
        </div>
        <ol className="space-y-2">{newRules.map((r, i) => renderRule(r, i, 'new'))}</ol>

        {/* standing orders the file at hand cites — lifted above the fold,
            highlighted like today's, whatever the collapse state below */}
        {relevantStanding.length > 0 && (
          <div className="mt-3 border-2 border-[#9C7A3C] bg-[#9C7A3C]/15 p-2">
            <div className="mb-1.5 font-pixel text-[7px] tracking-widest text-[#8C2F2B] uppercase">
              Relevant to this file
            </div>
            <ol className="space-y-1.5">
              {relevantStanding.map(({ r, n }) => (
                <li
                  key={`rel-${r.id}`}
                  className="flex items-start gap-2 bg-[#9C7A3C] px-1 font-vt text-lg leading-tight text-[#1a2430]"
                >
                  <span className="mt-0.5 flex w-5 shrink-0 justify-center">
                    <RuleGlyph text={r.text} />
                  </span>
                  <span>
                    <span className="text-[#8C2F2B]">{n}.</span> {r.text}
                    {r.text.toLowerCase().includes('seal') && (
                      <span className="mt-1 flex items-center gap-2 border-2 border-dashed border-[#1a2430]/50 bg-[#D8C7A1]/60 px-2 py-1">
                        <img
                          src="/seal_valid.png"
                          alt="Genuine seal reference impression"
                          className="pixel-img h-10 w-10 shrink-0 object-contain"
                        />
                        <span className="font-pixel text-[6px] leading-relaxed tracking-widest text-[#8C2F2B] uppercase">
                          Seals must match this impression
                        </span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* standing orders from previous days — collapsed by default */}
        {standingRules.length > 0 && (
          <>
            <div className="mt-4 mb-2 border-t-2 border-dashed border-[#6E7278] pt-3">
              <button
                type="button"
                onClick={() => setStandingOpen((v) => !v)}
                aria-expanded={standingOpen}
                className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
              >
                <SectionStamp label={`Standing orders (${standingRules.length})`} />
                <span className="font-pixel text-[9px] tracking-widest text-[#6E7278]">
                  {standingOpen ? '▾' : '▸'}
                </span>
              </button>
            </div>
            {standingOpen && (
              <ol className="space-y-1.5">
                {standingRules.map((r, i) => renderRule(r, i, 'standing'))}
              </ol>
            )}
          </>
        )}

        <div className="mt-3 font-vt text-lg text-[#6E7278] italic">
          Check the seal first. Then the date. Then the face. The rest is weather.
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="hard-sm btn-press mt-3 w-full bg-[#2B3A4A] px-3 py-1 font-vt text-xl text-[#D8C7A1]"
          >
            CLOSE RULEBOOK
          </button>
        )}
      </div>
      <div className="torn-bottom" />
    </div>
  );
}
