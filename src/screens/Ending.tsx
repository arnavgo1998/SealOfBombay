import { PixelButton } from '../components/Chrome';
import type { GameState } from '../game/engine';
import { ENDINGS } from '../game/script';
import { AUTHOR_NAME, TWITTER_HANDLE, TWITTER_URL, DISCLAIMER } from '../game/credits';

interface EndingProps {
  run: GameState;
  onAgain: () => void;
}

export function Ending({ run, onAgain }: EndingProps) {
  const endingId = run.phase.kind === 'ending' ? run.phase.endingId : undefined;
  const ending = ENDINGS.find((e) => e.id === endingId) ?? ENDINGS[ENDINGS.length - 1];
  const bg = ending.id === 'taken_in' ? 'curfew' : 'dawn';

  return (
    <div className="relative min-h-[100dvh] overflow-hidden" data-ending={ending.id}>
      <img src={`/bg_${bg}.png`} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-[#1a2430]/60" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-3xl flex-col items-center justify-center px-4 py-8 md:py-16">
        <div className="hard fade-in w-full bg-[#2B3A4A]/95 p-5 md:p-10">
          <div className="checker-strip mb-6 w-full" />
          <div className="text-center">
            <div
              className="inline-block border-4 border-[#8C2F2B] px-5 py-2"
              style={{ transform: 'rotate(-2deg)' }}
            >
              <h1 className="font-pixel text-lg leading-relaxed text-[#8C2F2B] md:text-2xl md:leading-relaxed">
                {ending.title.toUpperCase()}
              </h1>
            </div>
            <p className="mt-4 font-vt text-2xl text-[#9C7A3C] italic">{ending.subtitle}</p>
          </div>

          <p className="mt-6 font-vt text-2xl leading-snug text-[#D8C7A1]">{ending.text}</p>

          {/* the arrest ledger: what fed the file, docket line by docket line */}
          {ending.id === 'taken_in' && (
            <div className="hard-sm mt-6 bg-[#1a2430] p-4 text-left">
              <div
                className="inline-block border-[3px] border-[#8C2F2B] px-2 py-0.5"
                style={{ transform: 'rotate(-1.5deg)' }}
              >
                <span className="font-pixel text-[9px] tracking-widest text-[#8C2F2B]">
                  WHAT DREW THE EYE
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {(run.suspicionLog.length > 0
                  ? run.suspicionLog
                  : ['The file does not say. Files never do.']
                ).map((entry, i) => (
                  <li
                    key={`${i}-${entry}`}
                    className="flex items-start gap-2 font-vt text-xl leading-tight text-[#B9A576]"
                    style={{ transform: `rotate(${i % 2 === 0 ? '-' : ''}0.4deg)` }}
                  >
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 border-2 border-[#8C2F2B]" />
                    {entry}
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t-2 border-dashed border-[#6E7278]/60 pt-2 font-vt text-lg text-[#6E7278] italic">
                The warrant cites the pattern, not the act.
              </p>
            </div>
          )}

          <div className="my-6 border-t-4 border-[#1a2430]" />

          <div className="grid grid-cols-2 gap-3 font-vt text-xl text-[#B9A576] md:grid-cols-4">
            <div className="hard-sm bg-[#1a2430] p-2 text-center">
              <div className="font-pixel text-[8px] text-[#6E7278]">DAYS SERVED</div>
              <div className="mt-1 text-3xl text-[#D8C7A1]">{run.daysServed}</div>
            </div>
            <div className="hard-sm bg-[#1a2430] p-2 text-center">
              <div className="font-pixel text-[8px] text-[#6E7278]">STAMPS MADE</div>
              <div className="mt-1 text-3xl text-[#D8C7A1]">{run.stats.approved + run.stats.denied + run.stats.detained}</div>
            </div>
            <div className="hard-sm bg-[#1a2430] p-2 text-center">
              <div className="font-pixel text-[8px] text-[#6E7278]">BRIBES TAKEN</div>
              <div className="mt-1 text-3xl text-[#9C7A3C]">{run.stats.bribes}</div>
            </div>
            <div className="hard-sm bg-[#1a2430] p-2 text-center">
              <div className="font-pixel text-[8px] text-[#6E7278]">DETAINED</div>
              <div className="mt-1 text-3xl text-[#8C2F2B]">{run.stats.detained}</div>
            </div>
          </div>

          <div className="mt-8 flex justify-center">
            <PixelButton pixel color="red" onClick={onAgain}>
              BEGIN AGAIN
            </PixelButton>
          </div>
          <div className="checker-strip mt-6 w-full" />
        </div>

        {/* stamped colophon — reads from game/credits.ts */}
        <div data-credits className="mt-4 text-center">
          <span
            className="inline-block border-[3px] border-[#9C7A3C]/70 px-3 py-1 font-vt text-lg text-[#9C7A3C]"
            style={{ transform: 'rotate(-1.2deg)' }}
          >
            EXAMINED BY {AUTHOR_NAME} ·{' '}
            <a
              href={TWITTER_URL}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-dotted underline-offset-4 hover:text-[#D8C7A1]"
            >
              {TWITTER_HANDLE}
            </a>
          </span>
          <p className="mx-auto mt-3 max-w-md font-vt text-sm leading-snug text-[#6E7278] italic">
            {DISCLAIMER}
          </p>
        </div>
      </div>
    </div>
  );
}
