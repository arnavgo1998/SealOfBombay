import { useEffect } from 'react';
import { KeyHint, PixelButton } from '../components/Chrome';
import { isTypingTarget } from '../lib/utils';
import type { GameDay } from '../game/script';
import { DAYS } from '../game/script';

interface DayIntroProps {
  day: GameDay;
  onContinue: () => void;
}

export function DayIntro({ day, onContinue }: DayIntroProps) {
  // Enter/Space = report for duty.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === 'enter' || k === ' ') {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onContinue]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#1a2430] px-4 py-8 md:py-16">
      <div className="hard fade-in w-full max-w-3xl bg-[#2B3A4A] p-5 md:p-12">
        <div className="mb-4 inline-block border-4 border-[#9C7A3C] px-4 py-1" style={{ transform: 'rotate(-1.5deg)' }}>
          <span className="font-pixel text-base tracking-widest text-[#9C7A3C]">{day.date.toUpperCase()}</span>
        </div>
        <div className="font-vt text-2xl text-[#6E7278]">
          DAY {day.day} OF {DAYS.length}
        </div>
        <h2 className="mt-1 font-vt text-5xl leading-none text-[#D8C7A1] md:text-6xl">{day.title}</h2>
        <div className="checker-strip my-6 w-full" />
        <p className="font-vt text-2xl leading-relaxed text-[#B9A576] md:text-3xl md:leading-relaxed">{day.intro}</p>
        <div className="mt-8 flex justify-end">
          <PixelButton pixel color="red" onClick={onContinue} className="min-h-11">
            REPORT FOR DUTY
            <KeyHint k="⏎" />
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
