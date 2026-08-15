import { useEffect } from 'react';
import { KeyHint, PixelButton } from '../components/Chrome';
import { isTypingTarget } from '../lib/utils';

interface ArrestProps {
  onContinue: () => void;
}

/** Immediate interstitial when suspicion reaches 100. */
export function Arrest({ onContinue }: ArrestProps) {
  // Enter/Space = sign the intake paper.
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
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#0d1319] px-4">
      <img src="/bg_curfew.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
      <div className="hard fade-in relative z-10 w-full max-w-2xl bg-[#1a2430] p-8 text-center md:p-12">
        <img src="/stamp_denied.png" alt="" className="mx-auto mb-6 h-24 w-24" style={{ transform: 'rotate(-8deg)' }} />
        <h1
          className="inline-block border-4 border-[#8C2F2B] px-6 py-3 font-pixel text-xl text-[#8C2F2B]"
          style={{ transform: 'rotate(-2deg)' }}
        >
          TAKEN IN
        </h1>
        <p className="mt-6 font-vt text-2xl leading-snug text-[#D8C7A1]">
          The review ends without warning, the way reviews do. There is a knock that is not a
          knock. There is a form. There is always a form — and this one has your name already
          typed in, in a hand very like your own.
        </p>
        <div className="mt-8 flex justify-center">
          <PixelButton pixel color="red" onClick={onContinue} className="min-h-11">
            SIGN THE INTAKE PAPER
            <KeyHint k="⏎" />
          </PixelButton>
        </div>
      </div>
    </div>
  );
}
