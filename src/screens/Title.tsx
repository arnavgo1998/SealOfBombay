import { useEffect, useRef, useState } from 'react';
import { PixelButton } from '../components/Chrome';
import { DAYS, ENDINGS } from '../game/script';
import { isTypingTarget } from '../lib/utils';
import { AUTHOR_NAME, TWITTER_HANDLE, TWITTER_URL, DISCLAIMER } from '../game/credits';
import {
  DEBUG_DAYS,
  DEBUG_ENDINGS,
  DEBUG_TOGGLES,
  GOD_MODE_ENABLED,
  GOD_MODE_PASSWORD,
  debugDayState,
  debugEndingState,
} from '../game/godmode';
import type { GameState } from '../game/engine';

interface TitleProps {
  hasSave: boolean;
  onBegin: () => void;
  onContinue: () => void;
  /** GOD MODE: load a pre-built debug state (see game/godmode.ts). */
  debugStart: (state: GameState) => void;
}

/** Slim brass colophon — reads entirely from game/credits.ts. */
function CreditsLine() {
  return (
    <p data-credits className="mt-6 font-vt text-lg text-[#9C7A3C]">
      A GAME BY {AUTHOR_NAME} ·{' '}
      <a
        href={TWITTER_URL}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-dotted underline-offset-4 hover:text-[#D8C7A1]"
      >
        {TWITTER_HANDLE}
      </a>
    </p>
  );
}

export function Title({ hasSave, onBegin, onContinue, debugStart }: TitleProps) {
  const [backRoom, setBackRoom] = useState(false);
  const buffer = useRef('');

  // GOD MODE: typing the password (no input field, case-insensitive) opens
  // the BACK ROOM. Deleting game/godmode.ts + its import kills all of this.
  useEffect(() => {
    if (!GOD_MODE_ENABLED) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;
      buffer.current = (buffer.current + e.key.toLowerCase()).slice(-GOD_MODE_PASSWORD.length);
      if (buffer.current === GOD_MODE_PASSWORD) {
        buffer.current = '';
        setBackRoom(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="relative min-h-[100dvh] overflow-hidden">
      {/* mobile-only heads-up — this ledger wants a keyboard */}
      <div className="fixed inset-x-0 top-0 z-50 border-b-4 border-[#1a2430] bg-[#8C2F2B] px-3 py-2 text-center font-vt text-base text-[#F5E6C8] shadow-[0_4px_0_#1a2430] md:hidden">
        Best played on desktop — this ledger likes a keyboard.
      </div>

      <img
        src="/title_screen.png"
        alt="Bombay harbour at dusk, pixel art"
        className="flicker absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[#1a2430]/45" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-4xl flex-col items-center justify-center px-4 pt-14 pb-8 md:px-6 md:py-16 text-center">
        <div className="hard fade-in bg-[#2B3A4A]/95 px-4 py-6 md:px-12 md:py-8">
          <div className="checker-strip mb-6 w-full" />
          <h1 className="font-pixel text-2xl leading-relaxed text-[#D8C7A1] md:text-4xl md:leading-relaxed">
            THE SEAL
            <br />
            OF <span className="text-[#8C2F2B]">BOMBAY</span>
          </h1>
          <p className="mt-4 font-vt text-2xl text-[#9C7A3C]">A permit examiner&apos;s ledger, 1941–1947</p>
          <div className="checker-strip mt-6 w-full" />

          <p className="mx-auto mt-6 max-w-xl font-vt text-xl leading-snug text-[#B9A576]">
            Bombay. The Empire is busy, and a busy Empire breeds paper. You are Keshav Damle,
            Permit Examiner, Grade III — a stool, a stamp, and a rulebook. Check the seal. Check
            the date. Check the face. Every stamp is a choice, and the ledger never forgets.
          </p>

          <div className="mt-8 flex flex-col items-center gap-4">
            {hasSave && (
              <PixelButton pixel color="brass" onClick={onContinue} className="w-72 max-w-full min-h-11 text-center">
                CONTINUE SHIFT
              </PixelButton>
            )}
            <PixelButton pixel color="red" onClick={onBegin} className="w-72 max-w-full min-h-11 text-center">
              BEGIN YOUR SHIFT
            </PixelButton>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3 font-vt text-lg text-[#6E7278]">
            <img src="/icon_stamp.png" alt="" className="h-6 w-6" />
            <span>{`${DAYS.length} days. Seven years. ${ENDINGS.length} endings.`}</span>
            <img src="/icon_permit.png" alt="" className="h-6 w-6" />
          </div>

          <CreditsLine />
          <p className="mx-auto mt-3 max-w-md font-vt text-sm leading-snug text-[#6E7278] italic">
            {DISCLAIMER}
          </p>
        </div>
      </div>

      {/* GOD MODE back room — stamp-red debug panel over the title */}
      {GOD_MODE_ENABLED && backRoom && (
        <div
          data-godmode="back-room"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-[#1a2430]/90 px-3"
        >
          <div className="hard slide-up max-h-[92dvh] w-full max-w-2xl overflow-y-auto border-[#8C2F2B] bg-[#2B3A4A] p-4 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div
                className="inline-block border-4 border-[#8C2F2B] px-3 py-1"
                style={{ transform: 'rotate(-1.5deg)' }}
              >
                <span className="font-pixel text-[11px] tracking-widest text-[#8C2F2B]">
                  BACK ROOM
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBackRoom(false)}
                className="hard-sm btn-press min-h-11 bg-[#1a2430] px-3 font-pixel text-[9px] tracking-widest text-[#9C7A3C]"
              >
                CLOSE ✕
              </button>
            </div>
            <p className="mt-2 font-vt text-lg text-[#B9A576] italic">
              Pandurang&apos;s drawer. Testing only — none of this is canon.
            </p>

            <div className="mt-4 font-pixel text-[8px] tracking-widest text-[#9C7A3C] uppercase">
              Jump to day
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 md:grid-cols-3">
              {DEBUG_DAYS.map((d) => (
                <button
                  key={d.index}
                  type="button"
                  data-god-day={d.index + 1}
                  onClick={() => debugStart(debugDayState(d.index))}
                  className="hard-sm btn-press min-h-11 bg-[#8C2F2B] px-2 py-1 text-left"
                >
                  <span className="font-pixel text-[9px] tracking-widest text-[#D8C7A1]">
                    {d.label}
                  </span>
                  <span className="block font-vt text-base leading-tight text-[#B9A576]">
                    {d.date}
                  </span>
                </button>
              ))}
            </div>

            <div className="mt-4 font-pixel text-[8px] tracking-widest text-[#9C7A3C] uppercase">
              Ending previews
            </div>
            <div className="mt-1.5 grid grid-cols-1 gap-2 md:grid-cols-2">
              {DEBUG_ENDINGS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  data-god-ending={e.id}
                  onClick={() => debugStart(debugEndingState(e.id))}
                  className="hard-sm btn-press min-h-11 bg-[#1a2430] px-2 py-1 text-left font-pixel text-[9px] tracking-widest text-[#8C2F2B]"
                >
                  {e.title.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="mt-4 font-pixel text-[8px] tracking-widest text-[#9C7A3C] uppercase">
              Ledger tampering
            </div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {DEBUG_TOGGLES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-god-toggle={t.id}
                  onClick={() => debugStart(debugDayState(0, t.overrides))}
                  className="hard-sm btn-press min-h-11 bg-[#9C7A3C] px-3 py-1 font-pixel text-[9px] tracking-widest text-[#1a2430]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
