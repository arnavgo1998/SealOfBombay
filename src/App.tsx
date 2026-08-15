import { useEffect, useRef } from 'react';
import { CrtOverlays, MuteButton } from './components/Chrome';
import { playBlast, startRain, stopRain } from './game/audio';
import { useGame } from './game/engine';
import { Arrest } from './screens/Arrest';
import { DayIntro } from './screens/DayIntro';
import { DaySummary } from './screens/DaySummary';
import { DeskShift } from './screens/DeskShift';
import { Ending } from './screens/Ending';
import { ScenePlayer } from './screens/ScenePlayer';
import { Title } from './screens/Title';
import { DAYS } from './game/script';

export default function App() {
  const game = useGame();
  const run = game.run;
  const day = run ? DAYS[run.dayIndex] : undefined;
  const phaseKind = run?.phase.kind;

  // Monsoon ambient: loop while a rain day's scenes/desk are on screen;
  // stop at day end (summary), on a different day, or when the run closes.
  useEffect(() => {
    const onStage = phaseKind === 'scene' || phaseKind === 'desk';
    if (run && day?.weather === 'rain' && onStage) startRain();
    else stopRain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.dayIndex, phaseKind, run === null]);

  // One distant rumble as a blast day's first scene opens — once per day.
  const blastDay = useRef(-1);
  useEffect(() => {
    if (run && day?.sfx === 'blast' && phaseKind === 'scene' && blastDay.current !== run.dayIndex) {
      blastDay.current = run.dayIndex;
      playBlast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.dayIndex, phaseKind, day?.sfx]);

  let screen: React.ReactNode;
  if (!run) {
    screen = (
      <Title
        hasSave={game.hasSave}
        onBegin={game.newGame}
        onContinue={game.continueGame}
        debugStart={game.debugStart}
      />
    );
  } else {
    switch (run.phase.kind) {
      case 'dayIntro':
        screen = <DayIntro day={DAYS[run.dayIndex]} onContinue={game.startDay} />;
        break;
      case 'scene':
        screen = <ScenePlayer game={game} run={run} />;
        break;
      case 'desk':
        screen = <DeskShift game={game} run={run} />;
        break;
      case 'summary':
        screen = <DaySummary run={run} onSleep={game.sleep} />;
        break;
      case 'arrest':
        screen = <Arrest onContinue={game.arrestContinue} />;
        break;
      case 'ending':
        screen = <Ending run={run} onAgain={game.abandon} />;
        break;
    }
  }

  return (
    <div className="font-vt">
      {screen}
      <MuteButton />
      <CrtOverlays />
    </div>
  );
}
