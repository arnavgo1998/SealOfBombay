// ============================================================================
// Day-1 case-1 guided walkthrough — Bomanji's spotlight tour of the desk.
// Each step names the `data-tut` attribute of the desk element it spotlights.
// ============================================================================

export interface TutorialStepDef {
  /** value of the target element's data-tut attribute */
  target: string;
  /** Bomanji's one line for this step */
  line: string;
  /** final card (over the stamp bar): releases the game, no counter */
  final?: boolean;
}

export const DESK_TUTORIAL: TutorialStepDef[] = [
  {
    target: 'grille',
    line: 'This is the person asking to pass. Their face must match the photograph on the booklet.',
  },
  {
    target: 'doc-name',
    line: 'The name. Across all their papers, it must read the same.',
  },
  {
    target: 'doc-ward',
    line: 'The ward. A pass is only good inside the ward it names.',
  },
  {
    target: 'doc-valid',
    line: "The date. Against today's date, up top. Expired paper is waste paper.",
  },
  {
    target: 'doc-seal',
    line: 'The seal. Compare it with the reference impression in the rulebook.',
  },
  {
    target: 'stamp-bar',
    line: 'Then stamp. A to approve, D to deny. The city will do the rest.',
    final: true,
  },
];
