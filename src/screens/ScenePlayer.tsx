import { useEffect, useRef, useState } from 'react';
import { KeyHint, NamePlate, PixelButton } from '../components/Chrome';
import { isTypingTarget } from '../lib/utils';
import { Typewriter } from '../components/Typewriter';
import type { TypewriterHandle } from '../components/Typewriter';
import { currentBeat, isChoiceAvailable, keshavMoodClass } from '../game/engine';
import type { GameApi, GameState } from '../game/engine';
import type { Choice } from '../game/script';
import { CHARACTERS } from '../game/script';
import { playPaper } from '../game/audio';

interface ScenePlayerProps {
  game: GameApi;
  run: GameState;
}

/**
 * Morning / evening beat player: the scenery fills the screen and the
 * speaking character stands IN it — a large framed portrait with a brass
 * nameplate, rising in when the speaker changes. The dialogue panel is a
 * slim strip overlapping the bottom of the scene. Narration beats (no
 * portrait) show only scenery + text.
 */
export function ScenePlayer({ game, run }: ScenePlayerProps) {
  const beat = currentBeat(run);
  const [typed, setTyped] = useState(false);
  const [consequence, setConsequence] = useState<{ text: string; success: boolean; next?: string } | null>(null);
  const typeRef = useRef<TypewriterHandle>(null);

  const beatId = beat?.id;
  useEffect(() => {
    setTyped(false);
    setConsequence(null);
  }, [beatId]);

  const choices = beat ? (beat.choices ?? []).filter((c) => isChoiceAvailable(run, c)) : [];

  const pick = (choice: Choice) => {
    const r = game.choose(choice);
    if (r.riskText) {
      setConsequence({ text: r.riskText, success: r.riskSuccess === true, next: choice.next });
    } else {
      playPaper();
      game.advanceToBeat(choice.next);
    }
  };

  const proceed = () => {
    playPaper();
    game.advanceBeat();
  };

  const closeConsequence = () => {
    if (!consequence) return;
    playPaper();
    const next = consequence.next;
    setConsequence(null);
    game.advanceToBeat(next);
  };

  // Keyboard: Enter/Space completes a typing line first, then advances;
  // number keys 1-4 pick choices (only once the line is fully shown).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (consequence) {
        if (k === 'enter' || k === ' ') {
          e.preventDefault();
          closeConsequence();
        }
        return;
      }
      if (!typed) {
        if (k === 'enter' || k === ' ') {
          e.preventDefault();
          typeRef.current?.complete();
        }
        return;
      }
      if (choices.length > 0) {
        const n = Number.parseInt(k, 10);
        if (n >= 1 && n <= choices.length && n <= 4) {
          e.preventDefault();
          pick(choices[n - 1]);
        }
        return;
      }
      if (k === 'enter' || k === ' ') {
        e.preventDefault();
        proceed();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, consequence, choices.length, beatId]);

  if (!beat || run.phase.kind !== 'scene') return null;
  const segment = run.phase.segment;

  const isNarrator = beat.speaker === 'Narrator';
  const character = Object.values(CHARACTERS).find(
    (c) => c.name === beat.speaker || c.name.includes(beat.speaker),
  );
  const speakerName = isNarrator ? '—' : (character?.name ?? beat.speaker);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#1a2430]">
      {/* scenery — the speaking character stands inside it */}
      <div className="relative h-[56dvh] w-full overflow-hidden border-b-4 border-[#1a2430] md:h-[64dvh]">
        <img
          key={beat.bg}
          src={`/bg_${beat.bg}.png`}
          alt=""
          className="fade-in h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[#1a2430]/35" />
        <div className="absolute top-3 left-3">
          <span className="hard-sm inline-block bg-[#2B3A4A] px-3 py-1 font-vt text-lg text-[#9C7A3C] uppercase">
            {segment === 'morning' ? 'Morning' : 'Evening'}
          </span>
        </div>

        {/* portrait in a photograph frame — sepia mat, hard indigo border,
            offset hard shadow, brass nameplate — rising in on speaker change.
            Size is capped (no full-height blow-ups) so pixels stay crisp. */}
        {beat.portrait && (
          <div
            key={beat.portrait}
            className="absolute inset-x-0 bottom-3 z-20 flex justify-center md:inset-x-auto md:left-[10%] md:justify-start"
          >
            {/* rise-in lives on the inner frame so its transform never fights
                the outer centering */}
            <div className="rise-in flex flex-col items-center">
              <div className="hard bg-[#D8C7A1] p-2">
                <img
                  src={`/bust_${beat.portrait}.png`}
                  alt={speakerName}
                  className={`pixel-img h-56 w-auto border-4 border-[#2B3A4A] object-cover md:h-64 lg:h-72 ${
                    beat.portrait === 'keshav' ? keshavMoodClass(run.meters) : ''
                  }`}
                />
              </div>
              <span className="hard-sm z-10 -mt-1 inline-block bg-[#9C7A3C] px-4 py-0.5 font-vt text-2xl tracking-wide text-[#1a2430] uppercase">
                {speakerName}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* slim dialogue panel, overlapping the bottom of the scene.
          Click pacing: first click finishes the line, second continues. */}
      <div className="relative z-10 mx-auto -mt-8 w-full max-w-4xl flex-1 px-4 pb-5">
        <div
          className="hard flex max-h-[34dvh] flex-col overflow-y-auto bg-[#2B3A4A] p-4 md:p-5"
          onClick={() => {
            if (consequence) return;
            if (!typed) {
              typeRef.current?.complete();
            } else if (choices.length === 0) {
              proceed();
            }
          }}
        >
          {!beat.portrait && (
            <div className="mb-2">
              <NamePlate>{speakerName}</NamePlate>
            </div>
          )}
          <Typewriter
            key={beat.id}
            ref={typeRef}
            text={beat.text}
            className={`flex-1 font-vt text-2xl leading-snug ${isNarrator ? 'text-[#B9A576] italic' : 'text-[#D8C7A1]'}`}
            onDone={() => setTyped(true)}
          />

          {typed && choices.length > 0 && (
            <div className="slide-up mt-4 space-y-2">
              {choices.some((c) => typeof c.effects?.rupees === 'number' && c.effects.rupees !== 0) && (
                <div className="mb-1 flex items-center gap-1.5">
                  <span className="font-pixel text-[7px] tracking-widest text-[#6E7278] uppercase">Tin box</span>
                  <span className={`font-vt text-lg font-bold ${run.rupees < 0 ? 'text-[#8C2F2B]' : 'text-[#9C7A3C]'}`}>
                    {run.rupees < 0 ? '−' : ''}₹{Math.abs(run.rupees)}
                  </span>
                </div>
              )}
              {choices.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="hard-sm btn-press block min-h-11 w-full bg-[#B9A576] px-4 py-2 text-left font-vt text-xl leading-tight text-[#1a2430] hover:bg-[#c9b78c]"
                >
                  ▸ {c.text}
                  {typeof c.effects?.rupees === 'number' && c.effects.rupees !== 0 && (
                    <span
                      className={`ml-1 text-lg font-bold ${
                        c.effects.rupees < 0 ? 'text-[#8C2F2B]' : 'text-[#5A7048]'
                      }`}
                    >
                      · {c.effects.rupees < 0 ? '−' : '+'}₹{Math.abs(c.effects.rupees)}
                    </span>
                  )}
                  {i < 4 && <KeyHint k={String(i + 1)} />}
                </button>
              ))}
            </div>
          )}

          {typed && choices.length === 0 && (
            <div className="mt-4 flex justify-end" onClick={(e) => e.stopPropagation()}>
              <PixelButton color="khaki" onClick={proceed} className="min-h-11">
                CONTINUE <span className="blink">▼</span>
                <KeyHint k="⏎" />
              </PixelButton>
            </div>
          )}
        </div>
      </div>

      {/* risk consequence card */}
      {consequence && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a2430]/85 px-4">
          <div className={`hard slide-up w-full max-w-2xl p-6 md:p-8 ${consequence.success ? 'bg-[#2B3A4A]' : 'bg-[#3a2222]'}`}>
            <div className="mb-3 text-center">
              <span
                className={`inline-block border-4 px-4 py-1 font-pixel text-[10px] tracking-widest ${
                  consequence.success ? 'border-[#9C7A3C] text-[#9C7A3C]' : 'border-[#8C2F2B] text-[#8C2F2B]'
                }`}
                style={{ transform: 'rotate(-2deg)' }}
              >
                {consequence.success ? 'IT HOLDS' : 'IT COMES APART'}
              </span>
            </div>
            <p className="font-vt text-2xl leading-snug text-[#D8C7A1]">{consequence.text}</p>
            <div className="mt-6 flex justify-end">
              <PixelButton color="khaki" onClick={closeConsequence} className="min-h-11">
                CONTINUE
                <KeyHint k="⏎" />
              </PixelButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
