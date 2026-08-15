import { useEffect, useRef, useState } from 'react';
import { KeyHint, PixelButton } from '../components/Chrome';
import { isTypingTarget } from '../lib/utils';
import { MeterHud } from '../components/MeterHud';
import { BriefingCard, Rulebook } from '../components/Rulebook';
import { DESK_TUTORIAL } from '../game/tutorial';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { Typewriter } from '../components/Typewriter';
import { currentCase, currentDay, getStandingRules } from '../game/engine';
import type { DeskAction, GameApi, GameState, StampResult } from '../game/engine';
import { assignBusts, entrantBustSrc, photoBustSrc } from '../game/entrants';
import type { EntrantBust } from '../game/entrants';
import { playPaper, playThud, playTick } from '../game/audio';
import type { CaseDocument, DocCase } from '../game/script';

type Stage = 'idle' | 'slam' | 'outcome';

interface DeskShiftProps {
  game: GameApi;
  run: GameState;
}

// ---------------------------------------------------------------------------
// Document-kind personality: every kind gets its own paper, border and ink,
// all drawn from the same palette.
// ---------------------------------------------------------------------------

interface KindStyle {
  bg: string;
  border: string;
  ink: string;
  sub: string; // secondary text on the paper
  accent: string; // field-label color on this paper
  icon: string;
  label: string;
}

const KIND_STYLE: Record<CaseDocument['kind'], KindStyle> = {
  permit:   { bg: '#D8C7A1', border: '#1a2430', ink: '#1a2430', sub: '#2B3A4A', accent: '#8C2F2B', icon: '/icon_permit.png',   label: 'Permit' },
  curfew:   { bg: '#2B3A4A', border: '#6E7278', ink: '#D8C7A1', sub: '#B9A576', accent: '#9C7A3C', icon: '/icon_curfew.png',   label: 'Curfew' },
  identity: { bg: '#B9A576', border: '#8C2F2B', ink: '#1a2430', sub: '#2B3A4A', accent: '#8C2F2B', icon: '/icon_identity.png', label: 'Identity' },
  ration:   { bg: '#5d7351', border: '#42543a', ink: '#D8C7A1', sub: '#D8C7A1', accent: '#1a2430', icon: '/icon_identity.png', label: 'Ration' },
  letter:   { bg: '#e6d8b8', border: '#B9A576', ink: '#1a2430', sub: '#2B3A4A', accent: '#8C2F2B', icon: '/icon_permit.png',   label: 'Letter' },
  manifest: { bg: '#D8C7A1', border: '#9C7A3C', ink: '#1a2430', sub: '#2B3A4A', accent: '#8C2F2B', icon: '/icon_stamp.png',    label: 'Manifest' },
  other:    { bg: '#D8C7A1', border: '#1a2430', ink: '#1a2430', sub: '#2B3A4A', accent: '#8C2F2B', icon: '/icon_permit.png',   label: 'Paper' },
};

/** CSS rectangular DETAINED stamp: double border, curfew indigo, -6deg. */
function DetainedStamp({ small = false, slam = false }: { small?: boolean; slam?: boolean }) {
  return (
    <div
      className={`inline-block border-[3px] border-[#2B3A4A] p-[3px] ${slam ? 'detain-slam' : ''}`}
      style={slam ? undefined : { transform: 'rotate(-6deg)' }}
    >
      <div
        className={`border-2 border-[#2B3A4A] px-3 py-1 font-pixel tracking-widest text-[#2B3A4A] ${
          small ? 'text-[8px]' : 'text-[12px]'
        }`}
      >
        DETAINED
      </div>
    </div>
  );
}

/** Small brass ₹ coin chip, slides in beside the stamp when a bribe is taken. */
function CoinChip() {
  return (
    <span className="coin-in hard-sm flex h-10 w-10 items-center justify-center bg-[#9C7A3C] font-vt text-2xl text-[#1a2430]">
      ₹
    </span>
  );
}

/**
 * Brass coin-pouch visual: a drawn-string pouch under a brass ₹ coin chip.
 * Rides inside the bribe speech card — the entrant slides it across.
 */
function BribePouch({ amount }: { amount: number }) {
  return (
    <div className="flex shrink-0 flex-col items-center" title={`An offer of ₹${amount}`}>
      {/* gathered pouch mouth + strings */}
      <div className="relative h-2 w-9 bg-[#6b5324]">
        <span className="absolute -top-1 left-1 h-2 w-[2px] rotate-[-24deg] bg-[#9C7A3C]" />
        <span className="absolute -top-1 right-1 h-2 w-[2px] rotate-[24deg] bg-[#9C7A3C]" />
      </div>
      {/* pouch body */}
      <div className="hard-sm flex h-10 w-12 items-center justify-center bg-[#9C7A3C] font-vt text-xl text-[#1a2430]">
        ₹{amount}
      </div>
    </div>
  );
}

/**
 * The sepia PHOTOGRAPH box pinned to the identity booklet's top-right corner.
 * Shows the entrant's bust — or a stranger's, when the case flags
 * `photoMismatch`. That mismatch is the tell.
 */
function PhotoBox({ src, alt }: { src: string; alt: string }) {
  return (
    <div
      className="pointer-events-none absolute top-2 right-2 flex w-24 flex-col items-center border-4 border-[#2B3A4A] bg-[#D8C7A1] p-1"
      style={{ transform: 'rotate(1.5deg)' }}
    >
      <img
        src={src}
        alt={alt}
        className="pixel-img h-20 w-20 border-2 border-[#1a2430] object-cover sepia"
      />
      <span className="mt-1 font-pixel text-[6px] tracking-widest text-[#2B3A4A] uppercase">
        Photograph
      </span>
    </div>
  );
}

/** First sentence of a longer text — the verdict docket's echo line. */
function firstSentence(text: string): string {
  const m = text.match(/^.*?[.!?](?:\s|$)/);
  return m ? m[0].trim() : text;
}

/** Per-document seal impression: valid, forged, or a dashed empty ring. */
function SealBlock({ doc, style }: { doc: CaseDocument; style: KindStyle }) {
  const sealField = doc.fields.find((f) => f.label === 'Seal');
  return (
    <div className="flex w-fit items-center gap-3" data-tut="doc-seal">
      {doc.sealState === 'missing' ? (
        <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-full border-4 border-dashed border-[#6E7278]">
          <span className="font-pixel text-[7px] tracking-widest uppercase" style={{ color: style.accent }}>
            No seal
          </span>
        </div>
      ) : (
        <img
          src={doc.sealState === 'forged' ? '/seal_forged.png' : '/seal_valid.png'}
          alt={doc.sealState === 'forged' ? 'Forged seal' : 'Genuine seal'}
          className="h-24 w-24 shrink-0 object-contain"
        />
      )}
      {sealField && (
        <div className="min-w-0">
          <div className="font-pixel text-[8px] tracking-widest uppercase" style={{ color: style.accent }}>
            Seal
          </div>
          <p className="font-vt text-xl leading-tight" style={{ color: style.sub }}>
            {sealField.value}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * One document on the desk, styled by kind. The verdict stamp (passed in as
 * `stampSlot`) slams onto this card — the one currently on top of the stack.
 */
function DocumentCard({
  doc,
  c,
  animKey,
  stampSlot,
  bust,
  photoAvoid = [],
}: {
  doc: CaseDocument;
  c: DocCase;
  animKey: string;
  stampSlot?: React.ReactNode;
  /** This case's day-assigned bust (from assignBusts). */
  bust?: EntrantBust;
  /** Adjacent entrants' busts the photograph must not collide with. */
  photoAvoid?: EntrantBust[];
}) {
  const style = KIND_STYLE[doc.kind];
  const salutation = doc.kind === 'letter' ? doc.fields.find((f) => f.label === 'Salutation') : undefined;
  // The PHOTOGRAPH and Seal fields have visual renderings; 'Note' flavor was
  // absorbed into the entrant's spoken line in script v3 and is not rendered.
  const skip = new Set(['Photograph', 'Seal', 'Note', 'Salutation']);
  const fields = doc.fields.filter((f) => !skip.has(f.label));

  return (
    <div
      key={animKey}
      data-doc-card
      className="hard paper-swap relative p-4 md:p-5"
      style={{ background: style.bg, borderColor: style.border, color: style.ink }}
    >
      <img
        src={style.icon}
        alt=""
        className="pointer-events-none absolute top-1/2 left-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 opacity-10"
      />
      {/* affixed photograph — identity booklets only */}
      {doc.kind === 'identity' && (
        <PhotoBox
          src={photoBustSrc(c, bust, photoAvoid)}
          alt={`Photograph on ${c.entrantName}'s ${doc.title}`}
        />
      )}
      {/* header: document-kind icon + document title */}
      <div
        className={`mb-3 flex items-center gap-3 border-b-4 pb-2 ${doc.kind === 'identity' ? 'pr-28' : ''}`}
        style={{ borderColor: style.border }}
      >
        <img src={style.icon} alt="" className="h-10 w-10 shrink-0" />
        <div className="min-w-0">
          <div className="font-pixel text-[7px] tracking-widest uppercase" style={{ color: style.sub }}>
            {style.label}
          </div>
          <div className="font-pixel text-[9px] leading-relaxed break-words uppercase">
            {doc.title}
          </div>
        </div>
        {/* seal status is never fully invisible: a tiny chip in the header
            telegraphs that a seal impression (or its absence) is on file.
            Forged wears the same glyph as genuine — reading it is the job. */}
        {doc.sealState && (
          <span
            className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center border-2"
            style={{ borderColor: style.border }}
            title={doc.sealState === 'missing' ? 'No seal impression on this paper' : 'A seal impression rides on this paper'}
          >
            {doc.sealState === 'missing' ? (
              <span className="h-5 w-5 rounded-full border-2 border-dashed border-[#6E7278]" />
            ) : (
              <img src="/seal_valid.png" alt="Seal impression on file" className="pixel-img h-6 w-6 object-contain" />
            )}
          </span>
        )}
      </div>

      {/* letter salutation — the folded letter opens with its greeting */}
      {salutation && (
        <p className="mb-2 font-vt text-2xl leading-tight italic" style={{ color: style.sub }}>
          {salutation.value}
        </p>
      )}

      <dl className="relative space-y-2.5">
        {fields.map((f) => {
          if (f.label.startsWith('Valid')) {
            return (
              <div key={f.label}>
                <div
                  className="inline-block border-2 border-dashed border-[#6E7278] px-3 py-1.5"
                  style={{ background: `${style.sub}22` }}
                  data-tut="doc-valid"
                >
                  <dt className="font-pixel text-[7px] tracking-widest uppercase" style={{ color: style.accent }}>
                    {f.label}
                  </dt>
                  <dd className="font-vt text-3xl leading-tight">{f.value}</dd>
                </div>
              </div>
            );
          }
          if (f.label === 'Ward') {
            return (
              <div key={f.label}>
                <div
                  className="hard-sm inline-flex items-center gap-2 bg-[#2B3A4A] px-2 py-0.5"
                  data-tut="doc-ward"
                >
                  <dt className="font-pixel text-[7px] tracking-widest text-[#9C7A3C] uppercase">
                    Ward
                  </dt>
                  <dd className="font-vt text-xl text-[#D8C7A1]">{f.value}</dd>
                </div>
              </div>
            );
          }
          return (
            <div
              key={f.label}
              className={`font-vt text-2xl leading-tight ${f.label === 'Name' ? 'w-fit' : ''}`}
              data-tut={f.label === 'Name' ? 'doc-name' : undefined}
            >
              <dt className="inline font-bold uppercase" style={{ color: style.accent }}>
                {f.label}:{' '}
              </dt>
              <dd className="inline" style={{ color: style.sub }}>
                {f.value}
              </dd>
            </div>
          );
        })}
        {doc.sealState && <SealBlock doc={doc} style={style} />}
      </dl>

      {stampSlot}
    </div>
  );
}

/**
 * The desk shift: grille window + entrant speech + document stack center,
 * rulebook left (drawer below on mobile), meter HUD right (strip on top on
 * mobile), stamp actions below. Stamping slams the verdict onto the document
 * on top of the stack; the entrant slides out and the outcome card slides in.
 */
export function DeskShift({ game, run }: DeskShiftProps) {
  const day = currentDay(run);
  const c = currentCase(run);
  const caseIndex = run.phase.kind === 'desk' ? run.phase.caseIndex : 0;
  const isLast = caseIndex >= day.cases.length - 1;
  // Per-day face assignment: no bust repeats back-to-back, none >2 a day.
  const dayBusts = assignBusts(
    day.cases.map((cc) => cc.id),
    run.dayIndex,
  );
  // Desktop = briefing inline in the rulebook panel; mobile = modal overlay.
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [showRules, setShowRules] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [stage, setStage] = useState<Stage>('idle');
  const [result, setResult] = useState<(StampResult & { action: DeskAction }) | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [tutStep, setTutStep] = useState(-1); // -1 = no walkthrough running
  const [shaking, setShaking] = useState(false);
  const [docIndex, setDocIndex] = useState(0);
  const [seenDocs, setSeenDocs] = useState<ReadonlySet<number>>(new Set([0]));
  const timers = useRef<number[]>([]);

  // Bomanji's briefing opens once per day at shift start — a BLOCKING modal
  // over the whole desk (desktop too). The rulebook itself stays closed; the
  // modal IS the acknowledgement, and R opens the rulebook afterwards.
  useEffect(() => {
    if (run.rulebookSeenDay !== run.dayIndex) {
      setShowBriefing(true);
      game.markRulebookSeen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.dayIndex]);

  // Reset per-case UI when the case changes; the next paper slides in.
  // If this case was already stamped before a reload, skip it — its effects
  // were applied and it must not be stamped twice.
  useEffect(() => {
    if (c && run.stampedCases.includes(c.id)) {
      game.nextCase();
      return;
    }
    setStage('idle');
    setResult(null);
    setNoteOpen(false);
    setDocIndex(0);
    setSeenDocs(new Set([0]));
    playPaper();
    playTick(0.6); // the shift-clock hand ticks over with each new file
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseIndex, run.dayIndex]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Guided walkthrough: once the Bomanji briefing is dismissed on day 1
  // case 1, the spotlight tour runs — once per save. The rulebookSeenDay
  // check keeps it from firing before the auto-opened briefing appears.
  const tutorialArmed =
    run.dayIndex === 0 &&
    caseIndex === 0 &&
    !run.tutorialDone &&
    run.rulebookSeenDay === run.dayIndex;
  useEffect(() => {
    if (tutorialArmed && !showBriefing && tutStep === -1) {
      setTutStep(0);
    }
  }, [tutorialArmed, showBriefing, tutStep]);

  // Document scroll affordance: while the paper continues past the visible
  // bottom edge, a fade + "▾ SEAL BELOW / ▾ MORE" chip rides that edge.
  // Recomputed on scroll (window capture catches the desktop inner region),
  // resize, and every document switch.
  const [docHasMore, setDocHasMore] = useState(false);
  const docScrollRef = useRef<HTMLDivElement>(null);
  const nudgedKeyRef = useRef('');
  useEffect(() => {
    const update = () => {
      const el = docScrollRef.current;
      const card = el?.querySelector('[data-doc-card]');
      if (!el || !card) return;
      const cardBottom = card.getBoundingClientRect().bottom;
      // Desktop: the paper scrolls inside its own region. Mobile: the page
      // scrolls and the sticky stamp bar covers the bottom ~96px.
      const limit = isDesktop ? el.getBoundingClientRect().bottom : window.innerHeight - 96;
      setDocHasMore(cardBottom > limit + 8);
    };
    update();
    const raf = requestAnimationFrame(update);
    const late = window.setTimeout(update, 350); // fonts and images settling
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(late);
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [caseIndex, run.dayIndex, docIndex, isDesktop]);

  // One gentle auto-scroll nudge (~40px down and back) the first time a
  // taller-than-fits paper renders — desktop's internal region only; mobile
  // gets the chip's rise animation instead.
  useEffect(() => {
    if (!isDesktop || !docHasMore) return;
    const key = `${run.dayIndex}-${caseIndex}-${docIndex}`;
    if (nudgedKeyRef.current === key) return;
    nudgedKeyRef.current = key;
    const el = docScrollRef.current;
    if (!el || el.scrollTop > 4) return;
    const down = window.setTimeout(() => el.scrollTo({ top: 40, behavior: 'smooth' }), 450);
    const up = window.setTimeout(() => el.scrollTo({ top: 0, behavior: 'smooth' }), 1000);
    return () => {
      window.clearTimeout(down);
      window.clearTimeout(up);
    };
  }, [docHasMore, isDesktop, run.dayIndex, caseIndex, docIndex]);

  const advanceTutorial = () => {
    if (tutStep < 0) return;
    playPaper();
    if (tutStep >= DESK_TUTORIAL.length - 1) {
      setTutStep(-1);
      game.markTutorialDone();
    } else {
      setTutStep(tutStep + 1);
    }
  };

  const doStamp = (action: DeskAction) => {
    if (stage !== 'idle') return;
    playThud();
    const res = game.stamp(action);
    setResult({ ...res, action });
    setNoteOpen(res.moralWeight === true); // moral-weight outcomes auto-expand
    setStage('slam');
    setShaking(true);
    timers.current.push(window.setTimeout(() => setShaking(false), 180));
    timers.current.push(window.setTimeout(() => setStage('outcome'), 650));
  };

  const goNext = () => {
    setStage('idle');
    setResult(null);
    game.nextCase();
  };

  const selectDoc = (i: number) => {
    if (i === docIndex) return;
    playPaper();
    setDocIndex(i);
    setSeenDocs((prev) => new Set(prev).add(i));
  };

  // Keyboard shortcuts: A approve, D deny, T detain, B bribe, R rulebook,
  // Enter/Space advance from the outcome card.
  const bribeAvailable = !!(c?.bribe && c.outcomes.bribe);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (showBriefing) return; // the briefing modal owns the keyboard until TO WORK
      if (tutStep >= 0) return; // the walkthrough owns the keyboard
      const k = e.key.toLowerCase();
      if (k === 'r') {
        e.preventDefault();
        setShowRules((v) => !v);
        return;
      }
      if (stage === 'outcome') {
        if (k === 'enter' || k === ' ') {
          e.preventDefault();
          goNext();
        }
        return;
      }
      if (stage !== 'idle') return; // stamp mid-slam
      if (k === 'a') doStamp('approve');
      else if (k === 'd') doStamp('deny');
      else if (k === 't') doStamp('detain');
      else if (k === 'b' && bribeAvailable) doStamp('bribe');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, bribeAvailable, caseIndex, run.dayIndex, tutStep, showBriefing]);

  if (!c) return null;

  const stampImg = result && result.action === 'deny' ? '/stamp_denied.png' : '/stamp_approved.png';

  const busy = stage !== 'idle';
  const caseKey = `${run.dayIndex}-${caseIndex}`;
  const docs = c.documents;
  const activeDoc = docs[Math.min(docIndex, docs.length - 1)];

  // The shift clock: 9:00 → 18:00 spread evenly across the day's files.
  // Pure atmosphere — it never gates or fails anything. Rounded to 5 min.
  const SHIFT_START = 9 * 60;
  const SHIFT_SPAN = 9 * 60;
  const shiftMinutes =
    SHIFT_START + Math.round((caseIndex * SHIFT_SPAN) / day.cases.length / 5) * 5;
  const shiftTime = `${Math.floor(shiftMinutes / 60)}:${String(shiftMinutes % 60).padStart(2, '0')}`;

  // Cumulative rulebook: today's fresh orders vs. orders standing from before.
  const allRules = getStandingRules(run.dayIndex);
  const newRules = allRules.filter((r) => r.dayIndex === run.dayIndex);
  const standingRules = allRules.filter((r) => r.dayIndex !== run.dayIndex);

  // Bomanji's helping hand — a warm, generic line assembled from the day.
  const briefingLine = !showBriefing
    ? null
    : run.dayIndex === 0
      ? 'First day, Damle sahib. The orders are pinned up — read them before the first file.'
      : newRules.length === 0
        ? 'No new orders today, sahib. The old ones stand.'
        : `New orders came in the morning post. ${newRules.length} of them today. The rest stand from before.`;
  const dismissBriefing = () => {
    setShowBriefing(false);
    setShowRules(false);
  };

  // The verdict stamp slams onto the document currently on top of the stack,
  // overhanging the top edge (top-left on identity booklets, whose top-right
  // corner carries the photograph) so it stays visible under the outcome card.
  const stampCorner = activeDoc.kind === 'identity' ? '-left-3 -top-3' : '-right-3 -top-3';
  const stampSlot = stage !== 'idle' && result && (
    <div className={`pointer-events-none absolute ${stampCorner} flex items-start gap-2`}>
      {result.action === 'bribe' && <CoinChip />}
      {result.action === 'detain' ? (
        <DetainedStamp slam={stage === 'slam'} />
      ) : (
        <img
          src={stampImg}
          alt=""
          className={`h-28 w-28 ${stage === 'slam' ? 'stamp-slam' : ''}`}
          style={stage === 'outcome' ? { transform: 'rotate(-8deg)' } : undefined}
        />
      )}
    </div>
  );

  return (
    <div className={`relative min-h-[100dvh] lg:h-[100dvh] lg:overflow-hidden ${shaking ? 'screen-shake' : ''}`}>
      <img src="/bg_office.png" alt="" className="fixed inset-0 h-full w-full object-cover" />
      <div className="fixed inset-0 bg-[#1a2430]/55" />

      <div className="relative z-10 mx-auto grid max-w-7xl gap-4 px-3 py-4 md:px-4 lg:h-full lg:grid-cols-[300px_minmax(0,1fr)_260px]">
        {/* HUD — horizontal strip on top on mobile, right sidebar on desktop */}
        <div className="order-1 flex flex-wrap items-stretch gap-2 lg:order-3 lg:block lg:h-full lg:min-h-0 lg:space-y-4 lg:overflow-y-auto">
          <div className="hard min-w-28 flex-1 bg-[#2B3A4A] p-3 text-center lg:flex-none">
            <div className="font-pixel text-[11px] tracking-widest text-[#9C7A3C]">{day.date.toUpperCase()}</div>
            <div className="mt-1 font-vt text-2xl leading-tight text-[#D8C7A1]">{day.title}</div>
            {/* brass shift-clock plaque — pure atmosphere, no fail state */}
            <div
              className="mt-2 inline-block bg-[#9C7A3C] px-2 py-1"
              style={{ transform: 'rotate(-0.5deg)' }}
              title="The shift runs 9:00 to 18:00"
            >
              <span className="font-pixel text-[10px] tracking-widest text-[#1a2430]">{shiftTime}</span>
            </div>
          </div>
          {/* brass desk plaque — compare the entrant's ward against THIS post */}
          {/* mr-11 on mobile keeps the plaque clear of the fixed mute button */}
          <div
            className="hard mr-11 min-w-28 flex-1 bg-[#9C7A3C] px-3 py-2 text-center lg:mr-0 lg:flex-none"
            style={{ transform: 'rotate(-0.6deg)' }}
          >
            <div className="font-pixel text-[7px] tracking-widest text-[#1a2430]/80 uppercase">
              This checkpost
            </div>
            <div className="font-pixel text-[13px] tracking-widest text-[#1a2430] uppercase">
              {day.post}
            </div>
          </div>
          <div className="w-full lg:w-auto">
            {/* tin box shows today's bribes the moment they're taken —
                they're credited to the ledger for real at day end */}
            <MeterHud
              meters={run.meters}
              rupees={run.rupees + (run.stats.bribeRupees - run.dayStart.stats.bribeRupees)}
            />
          </div>
        </div>

        {/* CENTER — grille, entrant speech, document stack, stamps.
            On lg this is a fixed-height flex column of regions so the whole
            desk fits one screen: grille (fixed) → speech/bribes (capped,
            scrolls) → documents (flex-1, own scroll) → stamp bar (pinned). */}
        <div className="order-2 min-w-0 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
          {/* grille window */}
          <div
            className="hard relative mb-3 shrink-0 bg-[#10161d] p-3 lg:mb-2 lg:flex lg:h-[30dvh] lg:flex-col"
            data-tut="grille"
          >
            <div className="mb-2 flex shrink-0 items-center justify-between">
              <span className="font-pixel text-[9px] tracking-widest text-[#9C7A3C] uppercase">
                At the grille
              </span>
              <span className="font-vt text-lg text-[#6E7278]">
                {caseIndex + 1} / {day.cases.length}
              </span>
            </div>
            <div className="hard-sm relative h-[26dvh] overflow-hidden bg-[#1a2430] lg:h-auto lg:min-h-0 lg:flex-1">
              <img
                src="/bg_office.png"
                alt=""
                className="absolute inset-0 h-full w-full object-cover opacity-25"
              />
              <img
                key={caseKey}
                src={entrantBustSrc(c, dayBusts[caseIndex])}
                alt={c.entrantName}
                className={`pixel-img relative mx-auto h-full w-auto object-cover ${
                  stage === 'idle' ? 'entrant-in' : 'entrant-out'
                }`}
              />
              {/* barred ticket window */}
              <div className="grille-bars pointer-events-none absolute inset-0" />
            </div>
            {/* brass name plate */}
            <div className="mt-2 flex shrink-0 justify-center">
              <span className="hard-sm inline-block bg-[#9C7A3C] px-4 py-0.5 font-vt text-2xl tracking-wide text-[#1a2430] uppercase">
                {c.entrantName}
              </span>
            </div>
          </div>

          {/* speech region — capped height on lg, scrolls if long */}
          <div className="shrink-0 lg:max-h-[18dvh] lg:overflow-y-auto lg:pr-1">
            {/* the entrant speaks — sepia speech card under the grille */}
            {c.entrantLine && (
              <div
                key={`line-${caseKey}`}
                className="speech-in hard-sm mb-3 min-h-24 border-l-8 border-[#9C7A3C] bg-[#D8C7A1] px-4 py-3 lg:mb-2"
              >
                <div className="font-pixel text-[7px] tracking-widest text-[#8C2F2B] uppercase">
                  {c.entrantName} says
                </div>
                <Typewriter
                  text={c.entrantLine}
                  speed={10}
                  className="font-vt text-2xl leading-snug text-[#1a2430]"
                />
              </div>
            )}
          </div>

          {/* the bribe — a brass card BELOW the speech, always fully visible,
              never inside the scroll region */}
          {bribeAvailable && c.bribeOffer && stage === 'idle' && (
            <div
              key={`bribe-${caseKey}`}
              className="bribe-in hard-sm mb-3 flex shrink-0 items-center gap-3 border-l-8 border-[#8C2F2B] bg-[#9C7A3C] px-4 py-3 lg:mb-2"
            >
              <BribePouch amount={c.bribe!.amount} />
              <div className="min-w-0">
                <div className="font-pixel text-[7px] tracking-widest text-[#1a2430]/80 uppercase">
                  An offer rides with the file
                </div>
                <p className="font-vt text-2xl leading-snug text-[#1a2430]">{c.bribeOffer}</p>
              </div>
            </div>
          )}

          {/* queue of faces */}
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5 lg:mb-2">
            {day.cases.map((qc, qi) => {
              const done = qi < caseIndex || (qi === caseIndex && stage === 'outcome');
              const current = qi === caseIndex && !done;
              return (
                <div
                  key={qc.id}
                  title={qc.entrantName}
                  className={`relative h-6 w-6 overflow-hidden border-2 ${
                    current ? 'border-[#9C7A3C]' : 'border-[#1a2430]'
                  } ${!done && !current ? 'opacity-40' : ''}`}
                >
                  <img
                    src={entrantBustSrc(qc, dayBusts[qi])}
                    alt={qc.entrantName}
                    className="h-full w-full object-cover"
                  />
                  {done && <div className="absolute inset-0 bg-[#8C2F2B]/60" />}
                </div>
              );
            })}
          </div>

          {/* document stack — flexes to fill the remaining desk height; the
              paper scrolls internally on lg so the stamp bar stays pinned */}
          <div className="flex min-h-0 flex-1 flex-col">
            {/* tab chits bring a document to the front */}
            {docs.length > 1 && (
            <div className="flex items-end gap-1.5 px-1">
              {docs.map((d, i) => {
                const ks = KIND_STYLE[d.kind];
                const active = i === docIndex;
                const unread = !seenDocs.has(i) && !active;
                return (
                  <button
                    key={`${caseKey}-tab-${i}`}
                    type="button"
                    onClick={() => selectDoc(i)}
                    title={d.title}
                    className={`relative flex min-h-11 min-w-11 flex-1 items-center gap-2 border-4 px-2 py-1.5 transition-transform ${
                      active ? 'z-10 -mb-1 pb-2.5' : 'mb-0 opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      background: ks.bg,
                      borderColor: ks.border,
                      color: ks.ink,
                      borderBottomColor: active ? ks.bg : ks.border,
                    }}
                  >
                    <img src={ks.icon} alt="" className="h-6 w-6 shrink-0" />
                    <span className="truncate font-pixel text-[7px] tracking-widest uppercase">
                      {d.title}
                    </span>
                    {unread && (
                      <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-[#8C2F2B]" aria-label="Unread document" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* the top document — internal scroll region on lg. The mobile
              wrapper clips the paper-swap / stamp-slam X-overflow (with 12px
              of breathing room for the stamp overhang) so those transient
              animations never push the page wider than the viewport. */}
            <div ref={docScrollRef} className="min-h-0 flex-1 lg:-mx-3 lg:overflow-y-auto lg:px-3 lg:pt-3">
              <div className="-mx-3 overflow-x-clip px-3 lg:contents">
                <DocumentCard
                  doc={activeDoc}
                  c={c}
                  animKey={`${caseKey}-${docIndex}`}
                  stampSlot={stampSlot}
                  bust={dayBusts[caseIndex]}
                  photoAvoid={[dayBusts[caseIndex - 1], dayBusts[caseIndex + 1]].filter(
                    (b): b is EntrantBust => !!b,
                  )}
                />
              </div>
              {/* scroll affordance: paper-colored fade + chip pinned to the
                  visible bottom edge while the document continues below it;
                  both vanish once the tail of the paper is in view */}
              {docHasMore && (
                <div
                  key={`afford-${caseKey}-${docIndex}`}
                  className="pointer-events-none sticky bottom-24 z-30 -mt-16 flex h-16 items-end justify-center pb-2 lg:bottom-2"
                  style={{
                    background: `linear-gradient(to top, ${KIND_STYLE[activeDoc.kind].bg}e0 0%, ${KIND_STYLE[activeDoc.kind].bg}00 80%)`,
                  }}
                >
                  <span className="chip-nudge border-2 border-[#8C2F2B] bg-[#D8C7A1] px-3 py-1 font-pixel text-[8px] tracking-widest text-[#8C2F2B]">
                    ▾ {activeDoc.sealState ? 'SEAL BELOW' : 'MORE'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* actions — pinned to the bottom of the desk on lg; sticky bar on mobile */}
          <div
            className="sticky bottom-0 z-40 mt-3 shrink-0 border-4 border-[#1a2430] bg-[#10161d] p-2 shadow-[4px_4px_0_#1a2430] lg:static lg:z-auto lg:mt-4 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none"
            data-tut="stamp-bar"
          >
            <div className="grid grid-cols-2 items-stretch gap-3 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <PixelButton pixel color="red" disabled={busy} onClick={() => doStamp('approve')} className="flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-center">
                <img src="/stamp_approved.png" alt="" className="pixel-img h-8 w-8" />
                <span>APPROVE<KeyHint k="A" /></span>
              </PixelButton>
              <PixelButton pixel color="red" disabled={busy} onClick={() => doStamp('deny')} className="flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-center">
                <img src="/stamp_denied.png" alt="" className="pixel-img h-8 w-8" />
                <span>DENY<KeyHint k="D" /></span>
              </PixelButton>
              <PixelButton pixel color="indigo" disabled={busy} onClick={() => doStamp('detain')} className="flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-center">
                <img src="/icon_stamp.png" alt="" className="pixel-img h-8 w-8" />
                <span>DETAIN<KeyHint k="T" /></span>
              </PixelButton>
              {bribeAvailable ? (
                <PixelButton pixel color="brass" disabled={busy} onClick={() => doStamp('bribe')} className="bribe-glow flex min-h-14 flex-col items-center justify-center gap-1 px-2 text-center whitespace-nowrap">
                  <span className="hard-sm flex h-8 w-8 items-center justify-center bg-[#D8C7A1] font-vt text-xl leading-none text-[#1a2430]">₹</span>
                  <span>
                    BRIBE <span className="font-vt text-base leading-none">₹{c.bribe!.amount}</span>
                    <KeyHint k="B" />
                  </span>
                </PixelButton>
              ) : (
                <div className="hard flex min-h-14 items-center justify-center bg-[#2B3A4A]/60 px-2 py-2">
                  <span className="font-vt text-lg text-[#6E7278] italic">no offer on the file</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RULEBOOK — left sidebar on desktop (own scroll), full-width drawer below on mobile */}
        <div className="order-3 lg:order-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col">
          <PixelButton
            color="indigo"
            onClick={() => setShowRules((v) => !v)}
            className="mb-3 min-h-11 w-full shrink-0 text-center"
          >
            {showRules ? '▲ RULEBOOK' : '▼ RULEBOOK'}
            <KeyHint k="R" />
          </PixelButton>
          {showRules && (
            <div className="slide-up lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1">
              <Rulebook
                date={day.date}
                newRules={newRules}
                standingRules={standingRules}
                highlightIds={c.ruleIds}
                showTutorial={run.dayIndex === 0}
              />
            </div>
          )}
        </div>
      </div>

      {/* mandatory briefing modal — every shift start, every viewport. Blocks
          the whole desk (clicks AND keyboard) until TO WORK dismisses it. */}
      {briefingLine && (
        <div
          data-briefing-modal
          className="fixed inset-0 z-[70] flex items-center justify-center px-4"
          style={{ background: 'rgba(26,32,42,.82)' }}
        >
          {/* scrollable when tall: the briefing's button row is sticky, so
              TO WORK stays pinned to the visible bottom edge */}
          <div className="slide-up max-h-[88dvh] w-full max-w-lg overflow-y-auto">
            <BriefingCard
              line={briefingLine}
              newRules={newRules}
              showTutorial={run.dayIndex === 0}
              onDismiss={dismissBriefing}
            />
          </div>
        </div>
      )}

      {/* verdict docket strip — the slammed stamp stays on the document; the
          strip echoes the first sentence and never gates the shift. Click
          anywhere outside the toggle (or Enter/Space) to move on. Outcomes
          carrying a story note or flag arrive already open. */}
      {stage === 'outcome' && result && (
        <div className="fixed inset-0 z-50 cursor-pointer" onClick={goNext}>
          <div className="absolute inset-x-0 bottom-0 px-3 pb-4 md:px-4 md:pb-5">
            <div className="hard slide-up mx-auto w-full max-w-3xl bg-[#2B3A4A] p-4">
              <div className="mb-2 flex items-center gap-3">
                {result.action === 'detain' ? (
                  <DetainedStamp small />
                ) : (
                  <>
                    <img src={stampImg} alt="" className="h-10 w-10" />
                    {result.action === 'bribe' && <CoinChip />}
                  </>
                )}
                <span className="font-pixel text-[10px] tracking-widest text-[#8C2F2B] uppercase">
                  {result.action === 'bribe' ? 'Stamped — and paid' : `Stamped: ${result.action}`}
                </span>
              </div>
              {noteOpen ? (
                <p className="font-vt text-2xl leading-snug text-[#D8C7A1]">{result.outcomeText}</p>
              ) : (
                <p className="font-vt text-xl leading-snug text-[#D8C7A1]">
                  {firstSentence(result.outcomeText)}
                </p>
              )}
              {result.riskText && (
                <p
                  className={`mt-2 border-t-4 border-[#1a2430] pt-2 font-vt text-xl leading-snug ${
                    result.riskSuccess ? 'text-[#9C7A3C]' : 'text-[#c05a54]'
                  }`}
                >
                  {result.riskText}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteOpen((v) => !v);
                  }}
                  className="hard-sm btn-press min-h-11 shrink-0 bg-[#1a2430] px-3 font-pixel text-[9px] tracking-widest text-[#9C7A3C]"
                >
                  {noteOpen ? 'CLOSE NOTE ▾' : 'FULL NOTE ▸'}
                </button>
                <span className="text-right font-vt text-xl leading-tight text-[#B9A576]">
                  {isLast ? 'CLOSE THE SHIFT' : 'NEXT ENTRANT'} <span className="blink">▸</span>
                  <KeyHint k="⏎" />
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* guided first-case walkthrough */}
      {tutStep >= 0 && (
        <TutorialOverlay step={tutStep} def={DESK_TUTORIAL[tutStep]} onAdvance={advanceTutorial} />
      )}
    </div>
  );
}
