import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { playTick } from '../game/audio';

interface TypewriterProps {
  text: string;
  speed?: number;
  onDone?: () => void;
  className?: string;
}

export interface TypewriterHandle {
  /** Reveal the whole text instantly (first click / Enter while typing). */
  complete: () => void;
  isDone: () => boolean;
}

/**
 * Typewriter reveal with procedural ticks. Click to complete instantly.
 * The full text is rendered invisibly behind the typed layer so the box
 * reserves its final height from the first character — the layout never
 * jumps as lines arrive.
 */
export const Typewriter = forwardRef<TypewriterHandle, TypewriterProps>(function Typewriter(
  { text, speed = 14, onDone, className = '' },
  ref,
) {
  const [n, setN] = useState(0);
  const done = n >= text.length;
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const doneFired = useRef(false);

  useImperativeHandle(ref, () => ({
    complete: () => setN(text.length),
    isDone: () => doneFired.current,
  }));

  useEffect(() => {
    setN(0);
    doneFired.current = false;
  }, [text]);

  useEffect(() => {
    if (done) {
      if (!doneFired.current) {
        doneFired.current = true;
        onDoneRef.current?.();
      }
      return;
    }
    const t = setTimeout(() => {
      setN((v) => v + 1);
      if (n % 3 === 0) playTick();
    }, speed);
    return () => clearTimeout(t);
  }, [n, done, speed]);

  return (
    <div
      className={`relative cursor-pointer whitespace-pre-wrap ${className}`}
      onClick={() => setN(text.length)}
      aria-label={text}
    >
      {/* invisible full text reserves the final box; trailing glyph holds
          room for the caret so even it can never push a line down */}
      <span className="invisible block whitespace-pre-wrap" aria-hidden>
        {text}▌
      </span>
      <span className="absolute inset-0 block whitespace-pre-wrap">
        {text.slice(0, n)}
        {!done && <span className="blink">▌</span>}
      </span>
    </div>
  );
});
