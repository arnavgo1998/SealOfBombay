import { useCallback, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { isTypingTarget } from '../lib/utils';
import { DESK_TUTORIAL } from '../game/tutorial';

/**
 * Guided first-case walkthrough: a clicky spotlight tour over the desk.
 * Each step dims the whole screen EXCEPT the element carrying the matching
 * `data-tut` attribute, which keeps a brass pulsing outline; a small
 * Bomanji card (bust + one line) anchors near the target — docked to the
 * bottom edge on narrow screens. Click anywhere or press Enter/→ to move on.
 */

import type { TutorialStepDef } from '../game/tutorial';

const DIM = 'rgba(26,32,42,.78)';
const PAD = 6;

interface TutorialOverlayProps {
  step: number;
  def: TutorialStepDef;
  onAdvance: () => void;
}

export function TutorialOverlay({ step, def, onAdvance }: TutorialOverlayProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [vw, setVw] = useState(() => window.innerWidth);
  const [vh, setVh] = useState(() => window.innerHeight);

  const measure = useCallback(() => {
    // pick the first VISIBLE match — the stamp bar renders twice (mobile
    // bottom bar + desktop sidebar), one always display:none
    const els = document.querySelectorAll(`[data-tut="${def.target}"]`);
    let el: Element | null = null;
    els.forEach((cand) => {
      if (!el && (cand as HTMLElement).offsetParent !== null) el = cand;
    });
    setRect(el ? (el as HTMLElement).getBoundingClientRect() : null);
    setVw(window.innerWidth);
    setVh(window.innerHeight);
  }, [def.target]);

  useEffect(() => {
    // bring the target into view once per step (it may sit inside a
    // scrollable document), then KEEP re-measuring: the speech card's
    // typewriter and paper animations shift layout for seconds, and a stale
    // rect is what throws the spotlight onto the wrong element
    const els = document.querySelectorAll(`[data-tut="${def.target}"]`);
    els.forEach((cand) => {
      if ((cand as HTMLElement).offsetParent !== null)
        (cand as HTMLElement).scrollIntoView({ block: 'nearest' });
    });
    const raf = requestAnimationFrame(measure);
    const poll = window.setInterval(measure, 200);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(poll);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure, def.target]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'enter' || k === 'arrowright') {
        e.preventDefault();
        e.stopPropagation();
        onAdvance();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onAdvance]);

  const r = rect
    ? {
        top: Math.max(0, rect.top - PAD),
        left: Math.max(0, rect.left - PAD),
        right: Math.min(vw, rect.right + PAD),
        bottom: Math.min(vh, rect.bottom + PAD),
      }
    : null;

  // Card placement: wide screens anchor beside the target (below it when the
  // target sits high, above it when it sits low); narrow screens dock bottom,
  // lifted clear of the stamp bar on the final step.
  const narrow = vw < 768;
  const CARD_W = 340;
  let cardStyle: CSSProperties;
  if (narrow || !r) {
    cardStyle = { left: 12, right: 12, bottom: def.final && r ? Math.max(12, vh - r.top + 10) : 12 };
  } else {
    const left = Math.min(Math.max(12, r.left), vw - CARD_W - 24);
    cardStyle =
      r.top > vh * 0.52
        ? { left, bottom: vh - r.top + 12, maxWidth: CARD_W }
        : { left, top: r.bottom + 12, maxWidth: CARD_W };
  }

  return (
    <div
      className="fixed inset-0 z-[80] cursor-pointer"
      onClick={onAdvance}
      role="button"
      aria-label={`Tutorial step ${step + 1}: ${def.line}`}
    >
      {/* dim everything except the spotlight target */}
      {r ? (
        <>
          <div className="absolute top-0 right-0 left-0" style={{ height: r.top, background: DIM }} />
          <div
            className="absolute right-0 bottom-0 left-0"
            style={{ top: r.bottom, background: DIM }}
          />
          <div
            className="absolute"
            style={{ top: r.top, left: 0, width: r.left, height: r.bottom - r.top, background: DIM }}
          />
          <div
            className="absolute"
            style={{ top: r.top, left: r.right, right: 0, height: r.bottom - r.top, background: DIM }}
          />
          <div
            className="tut-spot pointer-events-none absolute border-4 border-[#9C7A3C]"
            style={{ top: r.top, left: r.left, width: r.right - r.left, height: r.bottom - r.top }}
          />
        </>
      ) : (
        <div className="absolute inset-0" style={{ background: DIM }} />
      )}

      {/* Bomanji's card */}
      <div className="hard absolute flex items-start gap-3 bg-[#2B3A4A] p-3" style={cardStyle}>
        <img
          src="/bust_bomanji.png"
          alt="Bomanji"
          className="pixel-img h-14 w-14 shrink-0 border-2 border-[#1a2430] object-cover sepia"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="hard-sm inline-block bg-[#9C7A3C] px-2 py-0.5 font-pixel text-[7px] tracking-widest text-[#1a2430] uppercase">
              Bomanji
            </span>
            {!def.final && (
              <span className="font-vt text-lg leading-none text-[#6E7278]">
                {step + 1}/{DESK_TUTORIAL.length - 1}
              </span>
            )}
          </div>
          <p className="mt-1.5 font-vt text-xl leading-snug text-[#D8C7A1]">{def.line}</p>
          <p className="mt-1 font-vt text-base leading-none text-[#6E7278]">
            click anywhere · <span className="text-[#9C7A3C]">⏎</span> ▸
          </p>
        </div>
      </div>
    </div>
  );
}
