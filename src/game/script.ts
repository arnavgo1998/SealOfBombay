// ============================================================================
// THE SEAL OF BOMBAY — complete narrative data, v4
// A historical moral-choice game in the tradition of Papers, Please.
// Bombay, 1941-1947. You are Keshav Damle, Permit Examiner, Grade III.
//
// ENGINE NOTES
// - Visible meters: household, crown, movement. Start 50 (household 60).
// - Hidden meters: conscience, suspicion. suspicion >= 100 ends the game
//   early: set flag "arrested" and jump to ending "taken_in".
// - Effects.flag sets a story flag (string set). Condition.flag / flagNot
//   test membership. madhavAlive = NOT (flag "madhav_dead" or "madhav_arrested").
// - Choice.flagrant / bribe.flagrant marks a FLAGRANT corrupt act. Two or
//   more flagrant acts quietly blunt all future movement gains (engine-side
//   credibility debt). Small survival bribes are never flagrant.
// - DocCase.risk attaches to the riskiest resolution of that case (here:
//   approving the two Madhav cases). Roll p: on fail apply onFail and show
//   failText; else apply onSuccess and show successText. Applied IN ADDITION
//   to the chosen outcome's own effects.
// - DocCase.documents carries 1-3 CaseDocuments per entrant. Document FIELDS
//   state FACTS ONLY. The verdict is the player's job: dates are compared
//   against the HUD day date, wards against the desk plaque (GameDay.post),
//   seals against each document's sealState, faces against
//   DocCase.photoMismatch, and — on multi-document files — names, permit
//   numbers, wards, countersignatures, tonnages and stated purposes are
//   cross-checked BETWEEN documents. If the papers disagree with each
//   other, the file is bad even when every single document looks clean.
// - CaseDocument.sealState drives the seal IMAGE shown on that document in
//   the UI ('valid', 'forged', 'missing'). Set it on every document that
//   carries a seal or stamp.
// - DocCase.entrantLine is what the entrant says at the grille, in quotes,
//   in their own voice — spoken words and visible actions only. Keep
//   narration out of it where the entrant can carry it themselves.
// - DocCase.bribeOffer is the visible, motivated bribe: what they say or
//   slide across the file, and why. It is set on every case whose
//   DocCase.bribe is present; a bribe never appears unmotivated.
// - DocCase.photoMismatch = true shows a photograph that does not match the
//   entrant's face. Only set where a photo rule is in force that day.
// - GameDay.post is the checkpost ward shown on the desk plaque; ward rules
//   that day must be read against it.
// - Effects.rupees is an immediate delta to the tin-box cash ledger
//   (negative = spending). Used on evening/morning beat choices that are
//   gifts or expenses — medicine, milk, school fees, kitchen money — so
//   that generosity costs actual rupees the household may not have. Desk
//   bribes do NOT use it; bribe money enters via stats.bribeRupees.
// - GameDay.salary is the per-shift wage in rupees, credited to the cash
//   ledger at day end. The v4 economy curve (salary / householdCost):
//   D1 12/9, D2 12/10, D3 13/12, D4 13/12, D5 13/16, D6 13/17,
//   D7 14/15, D8 14/15, D9 15/16, D10 15/16, D11 16/15, D12 16/12.
//   A frugal player runs +2/day early, breaks even mid-war, and bleeds
//   -3 to -4/day through the 1943 famine unless bribes or choices close
//   the gap. That gap is the point: it is what makes a folded three-rupee
//   note under a file feel like an offer, not a prop. Day 12 pays out as
//   a final settlement of the old service.
// - v4 adds one mid-queue moral-dilemma case per day (ids *_moral_*;
//   Day 1 gets two). Their `correct` verdicts stay derivable from the
//   day's rules — the dilemma is moral, never a gotcha. Effects are kept
//   small (|household/crown/movement| <= 8, conscience/suspicion <= 12).
// - v6 pedagogy: Day 1 teaches with FOUR rules only — the visual/core
//   checks (seal, expiry, face, ward). Cross-checks (names, permit
//   numbers, customs endorsement) and detention for forged seals arrive
//   Day 2 as NEW issues; Day 1 denies a forged seal rather than
//   detaining, and every Day 1 case is decidable from those four rules.
// - v7 rulebook consolidation: the standing rulebook is capped at 30
//   unique orders by Day 12 (4 on Day 1, then at most 3 genuinely NEW
//   orders per day). The engine dedupes rules by normalized text, so a
//   re-issued order repeats the original text VERBATIM under its new id
//   and collapses into the original entry (case ruleIds on either id
//   still highlight it). Genuinely tightened orders (the four-anna fee
//   on Day 10) keep distinct text — that is real novelty. Folded checks
//   live as one order with alias ids: papers-agree cross-check (name /
//   permit number / ward: rn2_names = rn2_permitno = r2_names = r3_ration
//   = rn4_names = rn6_ration = rn8_names = r5_names = rn10_names =
//   rn11_names = rn11_permitno = r6_names); permit-reverse stamps
//   (rn2_fee = rn2_goods); sedition + bulk print (r2_ban = r2_press =
//   rn4_ban = rn4_press); cargo licence + manifest (r3_grain =
//   r3_manifest = rn6_grain); entry restrictions (r3_destitute =
//   r3_visits); dock cordon + rolls + loitering (r4_dockpass = r4_rolls =
//   r4_loiter); forged-seal detention (rn2_forgery = r4_seal = rn8_seal);
//   permit suspension + gatherings (r5_suspend = r5_assembly); barracks
//   cordon + kinship (r5_barracks = r5_kinship); press cards + strike
//   literature (r5_press = r5_leaflets); Dominion travel + refugee
//   certificates (r6_border = r6_refugee); weapons (rn11_weapons =
//   r6_weapons); and the Day 1 core orders re-issued verbatim throughout.
// - Endings are evaluated in listed order; first match wins.
// - EVENT_BEATS (after ENDINGS) are day-start consequence chains. The engine
//   evaluates them in array order — most urgent first — and plays the FIRST
//   chain whose `requires` matches and whose id flag is not yet set. Each
//   chain's terminal beat(s) carry effects.flag = chain id so it fires once.
// - GameDay.weather 'rain' loops the monsoon ambient all day; GameDay.sfx
//   'blast' plays one distant explosion rumble as the day's first scene opens.
// - All organizations, laws, ships, prisons and permit codes are fictional.
// ============================================================================

export interface Effects {
  household?: number;
  crown?: number;
  movement?: number;
  conscience?: number;
  suspicion?: number;
  rupees?: number; // immediate tin-box delta (negative = spending)
  note?: string;
  flag?: string;
}

export interface Risk {
  p: number;
  onFail: Effects;
  onSuccess: Effects;
  failText: string;
  successText: string;
}

export interface Condition {
  crownMin?: number;
  crownMax?: number;
  movementMin?: number;
  movementMax?: number;
  householdMin?: number;
  householdMax?: number;
  conscienceMin?: number;
  conscienceMax?: number;
  suspicionMin?: number; // hidden meter — mainly for consequence event chains
  suspicionMax?: number;
  flag?: string;
  flagNot?: string;
  madhavAlive?: boolean;
  rupeesMin?: number; // tin-box cash at least this (used by event-chain choices)
  dayIndexMax?: number; // chain must not fire on days after this 0-based index
}

export interface Choice {
  id: string;
  text: string;
  effects?: Effects;
  risk?: Risk;
  flagrant?: boolean;
  requires?: Condition;
  next?: string;
}

export interface Beat {
  id: string;
  bg: 'office' | 'chawl' | 'maidan' | 'harbour' | 'curfew' | 'dawn';
  speaker: string;
  portrait?: 'keshav' | 'radha' | 'madhav' | 'leela' | 'anna' | 'bomanji' | 'pandurang';
  text: string;
  choices?: Choice[];
  next?: string;
  effects?: Effects;
  requires?: Condition; // beat is shown only if the condition holds (same shape as Choice.requires)
}

export interface CaseDocument {
  kind: 'permit' | 'curfew' | 'identity' | 'ration' | 'letter' | 'manifest' | 'other';
  title: string;              // "Travel Permit", "Identity Booklet", "Curfew Pass", "Ration Card"...
  fields: { label: string; value: string }[];
  sealState?: 'valid' | 'forged' | 'missing';
}

export interface DocCase {
  id: string;
  entrantName: string;
  entrantPortrait?: string;
  portraitBg?: string;
  documents: CaseDocument[];
  entrantLine?: string;
  bribeOffer?: string;
  ruleIds: string[];
  correct: 'approve' | 'deny' | 'detain';
  photoMismatch?: boolean;
  bribe?: { amount: number; flagrant?: boolean };
  outcomes: {
    approve: Effects & { text: string };
    deny: Effects & { text: string };
    detain: Effects & { text: string };
    bribe?: Effects & { text: string };
  };
  risk?: Risk;
}

export interface Rule {
  id: string;
  text: string;
}

export interface GameDay {
  day: number;
  date: string;
  title: string;
  post: string;
  intro: string;
  weather?: 'rain'; // rain = monsoon ambient loop for the whole day
  sfx?: 'blast'; // blast = one distant explosion rumble as the day's first scene opens
  morning: Beat[];
  rules: Rule[];
  cases: DocCase[];
  evening: Beat[];
  householdCost: number;
  salary: number;
  summaryText: string;
}

export interface Ending {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  condition: Condition;
}

// ============================================================================
// CHARACTERS
// ============================================================================

export const CHARACTERS: Record<string, { name: string; role: string }> = {
  keshav: {
    name: 'Keshav Damle',
    role: 'Permit Examiner, Grade III, Fort checkpost. Forty-one years old when the story begins. A man who signs his name for a living.',
  },
  radha: {
    name: 'Radha Damle',
    role: "Keshav's wife. Composed and exact. Keeps the household ledger in her head to the last paisa.",
  },
  madhav: {
    name: 'Madhav Damle',
    role: 'The son. Seventeen in 1941. Fervent. Reads banned pamphlets the way other boys read cricket scores.',
  },
  leela: {
    name: 'Leela Damle',
    role: "The daughter. Eight in 1941. Watchful. Asks child questions that land harder than any magistrate's.",
  },
  anna: {
    name: 'Domnic Menezes',
    role: 'Neighbour across the landing. His eldest son works the docks. Weary, and distrustful of both Empire and Movement in equal measure.',
  },
  bomanji: {
    name: 'Bomanji Kapadia',
    role: 'Fellow examiner, one desk over. Nervous, decent, perennially afraid of forms filled in wrong.',
  },
  pandurang: {
    name: 'Chief Examiner Pandurang',
    role: 'Supervisor of the Fort checkpost. Cold, self-satisfied, a believer in the ledger as a moral document.',
  },
};

// ============================================================================
// DAYS
// ============================================================================

export const DAYS: GameDay[] = [
  // ==========================================================================
  // DAY 1 — MARCH 1941 — THE APPOINTMENT
  // ==========================================================================
  {
    day: 1,
    date: 'March 1941',
    title: 'The Appointment',
    post: 'Fort',
    intro:
      'Bombay, March 1941. The war in Europe has made the Empire busy, and a busy Empire breeds paper. Today Keshav Damle, lately a railway clerk, reports to the Fort checkpost as a Permit Examiner, Grade III — a stool, a stamp, and a rulebook.',
    morning: [
      {
        id: 'd1_m1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha measures the morning rice into the pot and levels it with a finger, the way she levels everything. "A government stool," she says. "It pays a rupee more than the railway. It also makes enemies one at a time, and friends never." She does not look up. "Come home at six."',
        choices: [
          {
            id: 'd1_m1_a',
            text: '"I stamp paper, Radha. Paper cannot hate a man."',
            effects: { conscience: -5, note: 'You have already begun lying at your own table.' },
            next: 'd1_m2',
          },
          {
            id: 'd1_m1_b',
            text: '"I will come home at six. That much I can promise."',
            effects: { conscience: 5, note: 'A small promise, honestly sized.' },
            next: 'd1_m2',
          },
        ],
      },
      {
        id: 'd1_m1_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha measures the morning rice into the pot — one level finger\'s worth, no more — and says it without turning around: "A rupee more than the railway. Leela eats." She sets the lid on. "Come home at six."',
        choices: [
          {
            id: 'd1_m1_a',
            text: '"She has always eaten, Radha. This changes nothing."',
            effects: { conscience: -5, note: 'You have already begun lying at your own table.' },
            next: 'd1_m2',
          },
          {
            id: 'd1_m1_b',
            text: '"I will come home at six. That much I can promise."',
            effects: { conscience: 5, note: 'A small promise, honestly sized.' },
            next: 'd1_m2',
          },
        ],
      },
      {
        id: 'd1_m2',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav is seventeen and made entirely of elbows and opinions. He does not want to finish his matriculation. "The Empire is burning its own house to keep the war warm," he says, "and you want me to sit examinations for a post in it." Leela watches from the floor, saying nothing, missing nothing.',
        choices: [
          {
            id: 'd1_m2_a',
            text: 'Insist. "You will sit the examination. A starving man can afford no opinions."',
            effects: { movement: -3, crown: 3, note: 'Madhav goes quiet. It is not agreement.' },
            next: 'd1_m2b',
          },
          {
            id: 'd1_m2_b',
            text: '"Finish the year. Then the year is yours to spend as you choose."',
            effects: { movement: 3, conscience: 3, note: 'A treaty, not a victory. Madhav nods once.' },
            next: 'd1_m2b',
          },
          {
            id: 'd1_m2_c',
            text: 'Say nothing. Drink your tea. Let the boy have the last word.',
            effects: { movement: 5, crown: -3, conscience: -3, note: 'Silence is also a stamp. It approves whatever follows.' },
            next: 'd1_m2b',
          },
        ],
      },
      {
        id: 'd1_m2b',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The milkman has been at the door with his cans and his apologies: the dairy has raised the chawl rate, and he needs two rupees to keep this landing on his round. "Leela is eight," Radha says. "Two rupees is two days of rice." The milkman waits on the stairs.',
        choices: [
          {
            id: 'd1_m2b_a',
            text: 'Pay the two rupees. A growing child drinks milk.',
            effects: { rupees: -2, household: 2, conscience: 3, note: 'Two rupees for the month\'s milk. The milkman touches his forehead to the doorframe. Leela will not know there was ever a question, which is what the two rupees bought.' },
            next: 'd1_m3',
          },
          {
            id: 'd1_m2b_b',
            text: 'Cancel the milk. "She has tea. Tea is enough."',
            effects: { household: -3, conscience: -3, note: 'Radha nods and tells him herself, on the stairs, gently. Leela drinks tea at breakfast and asks no questions, which is somehow worse than questions.' },
            next: 'd1_m3',
          },
        ],
      },
      {
        id: 'd1_m3',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { crownMin: 52 },
        next: 'd1_m3_low',
        text:
          'Chief Examiner Pandurang shows you the stool, the stamp, the rulebook, in that order, as if ranking them. "The seal of this office is the Empire in miniature," he says. "It does not tire. It does not sympathize. It does not err. See that you do not disgrace it." He looks at you for a moment before returning to his papers. One desk over, Examiner Bomanji smiles at you the way a drowning man waves.',
        choices: [
          {
            id: 'd1_m3_a',
            text: 'Stand straight. "You can rely on me, sir."',
            effects: { crown: 5, conscience: -3, note: 'Pandurang files your obedience away where he can find it.' },
            next: 'd1_m4',
          },
          {
            id: 'd1_m3_b',
            text: 'Nod once. Take the stool. Read the rulebook.',
            effects: { note: 'You begin as you mean to continue: reading.' },
            next: 'd1_m4',
          },
        ],
      },
      {
        id: 'd1_m3_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Chief Examiner Pandurang shows you the stool, the stamp, the rulebook, in that order, as if ranking them. He does not wait for you to settle. "The seal of this office is the Empire in miniature," he says. "It does not tire. It does not sympathize. It does not err. See that you do not disgrace it." He has returned to his papers before the instruction lands. One desk over, Examiner Bomanji smiles at you the way a drowning man waves.',
        choices: [
          {
            id: 'd1_m3_a',
            text: 'Stand straight. "You can rely on me, sir."',
            effects: { crown: 5, conscience: -3, note: 'Pandurang files your obedience away where he can find it.' },
            next: 'd1_m4',
          },
          {
            id: 'd1_m3_b',
            text: 'Nod once. Take the stool. Read the rulebook.',
            effects: { note: 'You begin as you mean to continue: reading.' },
            next: 'd1_m4',
          },
        ],
      },
      {
        id: 'd1_m4',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'The queue outside is already forty deep when the shutter goes up. Bomanji leans over and whispers the only honest instruction you will receive all day: "Check the seal first. Then the date. Then the face, then the ward. The rest is weather." The first file slides under the grille.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'r1_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'r1_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'r1_photo', text: 'The face at the grille must match the photograph affixed to the identity booklet.' },
      { id: 'r1_ward', text: 'Transit passes are valid only within the ward named on the pass. A stated destination outside that ward voids the passage.' },
    ],
    cases: [
      {
        id: 'd1_c1',
        entrantName: 'Hargovind Seth',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Trade Transit Permit, Class B',
            fields: [
              { label: 'Name', value: 'Hargovind Seth, cloth merchant' },
              { label: 'Permit no.', value: 'FT-0417' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'December 1941' },
              { label: 'Reverse', value: 'Customs endorsement, dated March 1941' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Hargovind Seth' },
              { label: 'Registered trade', value: 'Cloth merchant, Fort ward' },
              { label: 'Permit record', value: 'FT-0417, Class B, entered March 1941' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Cloth, examiner sahib. Forty bolts of it, and every one of them legal." He lays the permit and the booklet down side by side, aligned to the millimetre.',
        ruleIds: ['r1_seal', 'r1_expiry', 'r1_ward', 'r1_photo'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'The stamp comes down clean. Seth folds the permit into his turban cloth and is gone before the ink dries.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny him on nothing. He argues for ten minutes and leaves promising to write to somebody. Behind you, Bomanji frowns at his own ledger and says nothing.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'You detain a merchant with perfect papers. Pandurang himself walks the man out, apologizes to him, and writes a small line in a small book with your name at the top of it.',
          },
        },
      },
      {
        id: 'd1_moral_seamstress',
        entrantName: 'Sundrabai Jadhav',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Vendor\'s Transit Pass, seamstress',
            fields: [
              { label: 'Name', value: 'Sundrabai Jadhav, seamstress' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'February 1941' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Purchase Chit, second-hand sewing machine',
            fields: [
              { label: 'Goods', value: 'One sewing machine, treadle, second-hand' },
              { label: 'Seller', value: 'Raddi dealer, Chor Bazaar' },
              { label: 'Price', value: 'Eleven rupees, paid' },
            ],
          },
        ],
        entrantLine: '"The ward office wanted a renewal fee — I did not have it. The man there said try the gate."',
        bribeOffer: 'She sets down three rupees, coins wrapped in the end of her sari. "The bangle money, sahib. There is no more after this."',
        ruleIds: ['r1_expiry', 'r1_seal'],
        correct: 'deny',
        bribe: { amount: 3 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'A month dead on the pass; you stamp it. She shifts the machine to her other shoulder and is gone before you can change your mind.',
          },
          deny: {
            crown: 3,
            conscience: -5,
            text: '"The pass expired in February. Two annas at the ward office and it lives again — the window is open till four." She lifts the machine and goes to find eleven rupees\' worth of work without the machine she bought to do it with.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'Detained over an expired pass and a second-hand sewing machine. The machine is logged as unclaimed goods. It is still there in June, in the way these things are still there.',
          },
          bribe: {
            household: 3,
            conscience: -5,
            note: 'Three rupees of bangle money. The smallest bribe the day offered, and the hardest to refuse.',
            text: 'The three coins are warm from the sari corner. The stamp comes down. She leaves lighter by a bangle and heavier by a living.',
          },
        },
      },
      {
        id: 'd1_moral_husband_paro',
        entrantName: 'Paro Nayak',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Work Transit Pass, stevedore',
            fields: [
              { label: 'Name', value: 'Raghu Nayak, stevedore, No. 2 berth' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'October 1941' },
              { label: 'Photograph', value: 'Affixed to the pass — a man\'s face' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Paro Nayak' },
              { label: 'Relation', value: 'Wife of Raghu Nayak, entered below his record' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Raghu is down with fever. I do the same work, same rate. The pass is his." She puts both papers on the counter.',
        ruleIds: ['r1_photo', 'r1_seal'],
        correct: 'deny',
        photoMismatch: true,
        outcomes: {
          approve: {
            suspicion: 4,
            conscience: 5,
            text: 'Her face, his photograph — you stamp it. She shoulders the hod at No. 2 berth the same morning. The pass register and the gang sheet sit in two different books. Whether they ever meet is a clerk\'s mood, and today you have bet on a clerk\'s mood.',
          },
          deny: {
            crown: 3,
            conscience: -8,
            text: '"The face must match the photograph. He can renew it himself when the fever breaks." She folds the pass into her blouse.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            suspicion: 3,
            text: 'Detained for carrying her husband\'s honest pass. The warder looks at the pass, at her, at you, and processes the paperwork with the visible distaste of a man shelling peas.',
          },
        },
        risk: {
          p: 0.3,
          onFail: { suspicion: 10 },
          onSuccess: { conscience: 3 },
          failText: 'By Friday the No. 2 berth clerk has compared the pass register with the gang sheet: Nayak worked by a woman, passed at your grille. Bomanji covers the discrepancy in the intake book without being asked, and will mention it, gently, for years.',
          successText: 'The berth clerk never looks up from his tea. Raghu Nayak is back on the gang by Monday, fever-broken, and the three days are never entered anywhere except a household ledger in Byculla, where they kept a roof.',
        },
      },
      {
        id: 'd1_c2',
        entrantName: 'Sakharam Pawar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Work Transit Pass, mill hand',
            fields: [
              { label: 'Name', value: 'Sakharam Pawar, Byculla mill' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'February 1941' },
              { label: 'Photograph', value: 'Affixed to the pass' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Pass expired, sahib. Came straight from the shift."',
        ruleIds: ['r1_expiry', 'r1_seal', 'r1_photo'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 3,
            text: 'You wave an expired pass through. The man\'s gratitude is immediate and embarrassing. Bomanji glances at the date stamp, then at you, then back at his ledger.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"Renew it at the ward office and come back tomorrow," you tell him. He looks at you the way men look at locked doors.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for an expired pass. Even Pandurang finds this excessive, and says so.',
          },
        },
      },
      {
        id: 'd1_c3',
        entrantName: 'Rama Anthone',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Vendor\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Rama Anthone, milk vendor' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Valid until', value: 'June 1941' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Dairy Supply Letter',
            fields: [
              { label: 'Salutation', value: '"To the examiner at the gate —"' },
              { label: 'From', value: 'Manager, Byculla Milk Union' },
              { label: 'Body', value: 'Rama Anthone is engaged to deliver two cans daily to the Fort dairies, at double rate, beginning this week.' },
            ],
          },
        ],
        entrantLine: '"Fort dairies pay double, sahib. Work is here, pass says Byculla."',
        bribeOffer: 'Two cans of milk sweating in the sun. "The Fort dairies pay double today, sahib. Eight rupees for a quick stamp." He slides the notes under the pass.',
        ruleIds: ['r1_ward', 'r1_seal', 'r1_expiry'],
        correct: 'deny',
        bribe: { amount: 8 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Wrong ward, waved through. He lifts his cans and is into the Fort before the next file arrives.',
          },
          deny: {
            crown: 3,
            text: '"Byculla pass, Byculla streets." He gathers his cans without argument.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'You detain a milkman. His cans are confiscated and will be poured out at the depot. Leela drinks milk at breakfast.',
          },
          bribe: {
            household: 8,
            conscience: -5,
            note: 'Eight rupees. Not flagrant — a survival bribe, the smallest denomination of corruption.',
            text: 'Eight rupees disappear into your tunic. The milk goes through.',
          },
        },
      },
      {
        id: 'd1_c4',
        entrantName: 'Joseph D\'Mello',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Commercial Traveller\'s Permit',
            fields: [
              { label: 'Name', value: 'Joseph D\'Mello, pharmaceuticals' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'March 1942' },
              { label: 'Seal', value: 'Seal impression, star motif; the lettering around the rim runs uneven, and the star sits off-centre' },
            ],
            sealState: 'forged',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Joseph D\'Mello' },
              { label: 'Permit record', value: 'Commercial traveller\'s permit, Fort, entered February 1941' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Pharmaceuticals, sahib. Samples for the Colaba doctors." His case is heavy. He does not offer to open it.',
        ruleIds: ['r1_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 10,
            text: 'You stamp a forged seal. D\'Mello thanks you too warmly and walks very fast toward Colaba. Whatever is in the case, it is now inside the ward, and it has your stamp for company.',
          },
          deny: {
            crown: 3,
            text: 'You deny him on the seal. He does not argue — men with forged papers rarely do — but he memorizes your face as he leaves. Bomanji watches the case go unopened. "Detention powers for suspect seals come with a later order," he says. "For now the gate refuses. The gate only."',
          },
          detain: {
            crown: -3,
            suspicion: 3,
            text: 'You signal the warder on the strength of a crooked star. Pandurang comes over, looks at the seal, and lets D\'Mello go with his case unopened. "We deny what is false, examiner. We do not yet detain for it — that power has not come down to us." The man walks very fast toward Colaba, and takes whatever is in the case with him.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'd1_e1',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { conscienceMin: 53 },
        next: 'd1_e1_low',
        text:
          'The first wage is on the table. Leela, eight years old and conducting her own examination of you, asks the question she has clearly been saving: "Baba. At your office. Did you let the good people through?"',
        choices: [
          {
            id: 'd1_e1_a',
            text: '"All of them, Leela."',
            effects: { conscience: -3, note: 'The first lie of the new job, told to its smallest citizen.' },
            next: 'd1_e2',
          },
          {
            id: 'd1_e1_b',
            text: '"The ones the rules allowed."',
            effects: { conscience: 3, note: 'She considers this. It is not the answer she wanted. It may be the only true one.' },
            next: 'd1_e2',
          },
          {
            id: 'd1_e1_c',
            text: '"I don\'t know yet. Ask me again in a year."',
            effects: { movement: 3, note: 'She nods, gravely, as though you have made an appointment with her.' },
            next: 'd1_e2',
          },
        ],
      },
      {
        id: 'd1_e1_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'The first wage is on the table. Leela has been watching the door since you came in, not moving, just accounting. Eight years old and conducting her own examination of you, she asks the question she has clearly been saving: "Baba. At your office. Did you let the good people through?"',
        choices: [
          {
            id: 'd1_e1_a',
            text: '"All of them, Leela."',
            effects: { conscience: -3, note: 'The first lie of the new job, told to its smallest citizen.' },
            next: 'd1_e2',
          },
          {
            id: 'd1_e1_b',
            text: '"The ones the rules allowed."',
            effects: { conscience: 3, note: 'She considers this. It is not the answer she wanted. It may be the only true one.' },
            next: 'd1_e2',
          },
          {
            id: 'd1_e1_c',
            text: '"I don\'t know yet. Ask me again in a year."',
            effects: { movement: 3, note: 'She nods, gravely, as though you have made an appointment with her.' },
            next: 'd1_e2',
          },
        ],
      },
      {
        id: 'd1_e2',
        bg: 'chawl',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        requires: { suspicionMax: 5 },
        next: 'd1_e2_low',
        text:
          'A knock after dinner. Bomanji, still in his office tunic, sweating through it. He left the day\'s intake ledger on his desk; if Pandurang finds it unlocked overnight there will be what he calls "a memo" and what his face calls a catastrophe. "It is only a walk back to the Fort," he says. "Twenty minutes. I am asking because my wife—" He stops. He does not finish it.',
        choices: [
          {
            id: 'd1_e2_a',
            text: 'Take your cap and walk back with him.',
            effects: { conscience: 5, flag: 'bomanji_owes', note: 'Bomanji talks the whole way about nothing. He will remember this. Men like Bomanji keep ledgers of kindness.' },
            next: 'd1_e3',
          },
          {
            id: 'd1_e2_b',
            text: '"Say nothing tomorrow. Say we counted it together at close."',
            effects: { suspicion: 5, conscience: -3, flag: 'bomanji_owes', note: 'A shared lie is a shared rope. Bomanji owes you now, and knows it.' },
            next: 'd1_e3',
          },
          {
            id: 'd1_e2_c',
            text: 'Send him back alone. It is his ledger.',
            effects: { crown: 3, note: 'He nods too many times and goes. The landing feels colder after.' },
            next: 'd1_e3',
          },
        ],
      },
      {
        id: 'd1_e2_low',
        bg: 'chawl',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'A knock after dinner. Bomanji, still in his office tunic, sweating through it. He left the day\'s intake ledger on his desk; if Pandurang finds it unlocked overnight — and today has given him reasons to look — there will be what he calls "a memo" and what his face calls something worse. "It is only a walk back to the Fort," he says. "Twenty minutes. I am asking because my wife—" He stops. He does not finish it.',
        choices: [
          {
            id: 'd1_e2_a',
            text: 'Take your cap and walk back with him.',
            effects: { conscience: 5, flag: 'bomanji_owes', note: 'Bomanji talks the whole way about nothing. He will remember this. Men like Bomanji keep ledgers of kindness.' },
            next: 'd1_e3',
          },
          {
            id: 'd1_e2_b',
            text: '"Say nothing tomorrow. Say we counted it together at close."',
            effects: { suspicion: 5, conscience: -3, flag: 'bomanji_owes', note: 'A shared lie is a shared rope. Bomanji owes you now, and knows it.' },
            next: 'd1_e3',
          },
          {
            id: 'd1_e2_c',
            text: 'Send him back alone. It is his ledger.',
            effects: { crown: 3, note: 'He nods too many times and goes. The landing feels colder after.' },
            next: 'd1_e3',
          },
        ],
      },
      {
        id: 'd1_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The chawl settles. Somewhere below, Domnic Menezes is arguing with the water tap. Radha banks the stove and the room goes dark except for the landing light under the door.',
        next: undefined,
      },
    ],
    householdCost: 9,
    salary: 12,
    summaryText: 'Day 1 ends. Rice bought, rent held, first wage in the tin box. Household -{cost}.',
  },

  // ==========================================================================
  // DAY 2 — APRIL 1941 — THE SECOND MONTH (ordinary day)
  // ==========================================================================
  {
    day: 2,
    date: 'April 1941',
    title: 'The Second Month',
    post: 'Fort',
    intro:
      'Bombay, April 1941. The first month is behind you and the queue no longer looks like a mob; it looks like a list. The war is a rumour with a shipping schedule. Nothing happens today, which is exactly what the job is for: nothing, forty times, correctly.',
    morning: [
      {
        id: 'n2_m1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The first full month\'s wage lies on the table in an envelope Radha has not opened. On the windowsill: a letter from her sister in Nagpur, re-folded twice. She has not mentioned it. "Rent, rice, the dhobi, Leela\'s school annas," she recites, without looking up. "Whatever is left goes in the tin box, and the tin box is not a bank, Keshav. It is a superstition with a lid."',
        choices: [
          {
            id: 'n2_m1_a',
            text: 'Hand her the envelope unopened.',
            effects: { conscience: 5, household: 3, note: 'She counts it twice, nods once. The tin box swallows its first honest month.' },
            next: 'n2_m2',
          },
          {
            id: 'n2_m1_b',
            text: 'Keep two rupees back. Pocket them.',
            effects: { rupees: 2, household: -2, conscience: -5, note: 'Two rupees into your own pocket. There are no office expenses. She knows there are no office expenses. The two rupees weigh more than the envelope.' },
            next: 'n2_m2',
          },
        ],
      },
      {
        id: 'n2_m2',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { crownMin: 50 },
        next: 'n2_m2_low',
        text:
          'Leela has found your spare date-stamp pad and is printing her own hand, finger by finger, in violet. "At school the teacher says the Empire keeps us safe," she reports, in the flat tone of a child reading back a suspect document. "Is that what your stamp does, Baba? Keeps us safe?" Madhav snorts into his tea and says nothing, which for Madhav is a speech.',
        choices: [
          {
            id: 'n2_m2_a',
            text: '"The stamp keeps the road in order. Order is not the same as safe."',
            effects: { conscience: 3, note: 'She files the distinction away. You can hear the drawer close.' },
            next: 'n2_m3',
          },
          {
            id: 'n2_m2_b',
            text: '"Yes. That is what it does."',
            effects: { conscience: -3, note: 'She accepts the answer the way one accepts small change: without looking at it.' },
            next: 'n2_m3',
          },
        ],
      },
      {
        id: 'n2_m2_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'Leela has found your spare date-stamp pad and is printing her own hand, finger by finger, in violet. "At school the teacher says the Empire keeps us safe," she reports, in the flat tone of a child reading back a suspect document. "Is that what your stamp does, Baba? Keeps us safe?" Madhav sets down his tea without making a sound. He looks at his hands. Leela looks at Madhav. Then she looks at you.',
        next: 'n2_m3',
        choices: [
          {
            id: 'n2_m2_a',
            text: '"The stamp keeps the road in order. Order is not the same as safe."',
            effects: { conscience: 3, note: 'She files the distinction away. You can hear the drawer close.' },
            next: 'n2_m3',
          },
          {
            id: 'n2_m2_b',
            text: '"Yes. That is what it does."',
            effects: { conscience: -3, note: 'She accepts the answer the way one accepts small change: without looking at it.' },
            next: 'n2_m3',
          },
        ],
      },
      {
        id: 'n2_m3',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        requires: { suspicionMax: 10 },
        text:
          'Bomanji has survived his ledger fright and is expansive with relief. "Rules of the desk, Damle," he says, counting on his fingers. "Tea before the third file. Never argue before lunch. And when Pandurang counts the fee receipts on Friday, be somewhere else in the room." Pandurang passes behind him without a sound and Bomanji becomes very interested in his blotter, the way men salute a flag they do not love.',
        next: 'n2_m3_low',
      },
      {
        id: 'n2_m3_low',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'Bomanji closes his ledger and leans across. "Rules of the desk, Damle," he says, counting on his fingers. "Tea before the third file. Never argue before lunch. And when Pandurang counts the fee receipts on Friday, be somewhere else in the room." Three fingers. He does not offer a fourth. "Those are the ones I give everyone," he adds, and goes back to his ledger. Pandurang passes behind him without a sound and Bomanji becomes very interested in his blotter — he appears to have been studying it for some time already.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'rn2_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'rn2_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'rn2_photo', text: 'The face at the grille must match the photograph affixed to the identity booklet.' },
      { id: 'rn2_ward', text: 'Transit passes are valid only within the ward named on the pass. A stated destination outside that ward voids the passage.' },
      { id: 'rn2_fee', text: 'Check the reverse of every permit: new-issue permits carry the two-anna fee receipt stamp, and permits covering trade goods bear a customs endorsement.' },
      { id: 'rn2_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'rn2_permitno', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'rn2_goods', text: 'Check the reverse of every permit: new-issue permits carry the two-anna fee receipt stamp, and permits covering trade goods bear a customs endorsement.' },
      { id: 'rn2_forgery', text: 'Suspected forged seals or papers: detain the bearer and refer the file to the Chief Examiner.' },
    ],
    cases: [
      {
        id: 'n2_c1',
        entrantName: 'Trimbak Joshi',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Transit Pass, clerk class',
            fields: [
              { label: 'Name', value: 'Trimbak Joshi, temple clerk' },
              { label: 'Permit no.', value: 'FT-1188' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'December 1941' },
              { label: 'Reverse', value: 'Fee receipt stamp, two annas' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Trimbak Joshi' },
              { label: 'Registered trade', value: 'Temple clerk, Fort ward' },
              { label: 'Permit record', value: 'FT-1188, clerk class, entered April 1941' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Temple accounts do not examine themselves, sahib." He sets down pass and booklet together and bows to the stamp before it has even moved.',
        ruleIds: ['rn2_seal', 'rn2_expiry', 'rn2_ward', 'rn2_fee', 'rn2_names', 'rn2_permitno'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order. He bows to the stamp as much as to you, collects his pass with both hands, and goes.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny him on nothing. He asks what is wrong. There is no answer.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained on a valid pass. He is released before lunch with an apology written in the office\'s most reluctant handwriting. Bomanji looks at you the way one looks at a man who has shouted at a child in the street.',
          },
        },
      },
      {
        id: 'n2_c2',
        entrantName: 'Mahadu Sathe',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Work Transit Pass, mill hand',
            fields: [
              { label: 'Name', value: 'Mahadu Sathe, Girangaon mill' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'August 1941' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Mahadu Sathe' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
              { label: 'Booklet issued', value: 'Girangaon ward office, last monsoon' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: 'He holds the pass the way men hold borrowed things. "My cousin\'s," he says at last. "He went back to the district. Mill only needs the hands."',
        ruleIds: ['rn2_photo', 'rn2_seal', 'rn2_expiry'],
        correct: 'deny',
        photoMismatch: true,
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 3,
            text: 'The face is not the photograph and you stamp it anyway. He exhales like a man surfacing.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"The face must match the photograph. Get your own pass at the ward office." He nods before you finish — he has clearly rehearsed this refusal in his head and only came to hear it aloud.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for carrying his cousin\'s honest pass. The warder logs it under "impersonation" — the pass is real; only the face is wrong.',
          },
        },
      },
      {
        id: 'n2_moral_notice_warrant',
        entrantName: 'Tukaram Phadke',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Transit Pass, bailiff\'s peon',
            fields: [
              { label: 'Name', value: 'Tukaram Phadke, process-server, Small Causes bailiff\'s office' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'June 1941' },
              { label: 'Reverse', value: 'Fee receipt stamp, two annas' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Tukaram Phadke' },
              { label: 'Registered trade', value: 'Process-server, Fort ward' },
              { label: 'Permit record', value: 'FT-1202, bailiff\'s peon, entered April 1941' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Distraint Warrant, copy for the gate',
            fields: [
              { label: 'Addressed to', value: 'Widow A. Prabhudesai, Bhendi Bazaar' },
              { label: 'Goods listed', value: 'One sewing table; brass pots; a harmonium' },
              { label: 'Cause', value: 'Rent standing eight months' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Distraint warrant, sahib. Eight months standing." He sets the file on the counter.',
        ruleIds: ['rn2_seal', 'rn2_expiry', 'rn2_ward', 'rn2_fee', 'rn2_names', 'rn2_permitno'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: -5,
            text: 'In order. You stamp him through. He collects the file and goes.',
          },
          deny: {
            crown: -3,
            conscience: 3,
            text: 'You find no fault and deny him anyway. He nods like a man who has learned this answer before. "The bailiff will send me again tomorrow, sahib."',
          },
          detain: {
            crown: -5,
            conscience: -3,
            suspicion: 5,
            text: 'You detain a court\'s process-server on flawless papers. The bailiff telephones; the magistrate\'s clerk telephones; Pandurang releases the man and asks you, conversationally, whether this office is now in the business of overruling courts.',
          },
        },
      },
      {
        id: 'n2_c3',
        entrantName: 'Gangabai Shirodkar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Vendor\'s Transit Pass, flower seller',
            fields: [
              { label: 'Name', value: 'Gangabai Shirodkar' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'June 1941' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Gangabai Shirodkar' },
              { label: 'Valid until', value: 'March 1941' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"The ward office queue is three days, sahib. My flowers last one." Marigolds wilt in a basket at her feet.',
        bribeOffer: 'She unwraps three rupees from the corner of her sari and lays them on the file. "The whole basket twice over, sahib. Yours, if the stamp is quick."',
        ruleIds: ['rn2_expiry', 'rn2_seal', 'rn2_names'],
        correct: 'deny',
        bribe: { amount: 3 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'A booklet expired by a month; through anyway. She lifts the basket onto her head and goes to sell her marigolds under your stamp.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"The booklet expired in March. Renew it at the ward office." She gathers the rupees back into the sari corner and lifts the basket onto her head.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for a lapsed identity booklet. The marigolds are logged as perishable property. By evening they are garbage. Even the warder looks away.',
          },
          bribe: {
            household: 3,
            conscience: -4,
            note: 'Three rupees, wrapped in a marigold petal. The smallest door in the world, and you opened it.',
            text: 'Three rupees in your pocket. The pass is stamped. She leaves the marigolds on the counter and goes.',
          },
        },
      },
      {
        id: 'n2_c4',
        entrantName: 'Santoo Yadav',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Carrier\'s Transit Pass, dabbawala',
            fields: [
              { label: 'Name', value: 'Santoo Yadav' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Valid until', value: 'October 1941' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Tiffin Delivery Chit',
            fields: [
              { label: 'Kitchen', value: 'Byculla Kitchen No. 3' },
              { label: 'Deliveries', value: 'Sixty tiffins, addressed by name to offices in Fort ward' },
              { label: 'Marks', value: 'Kitchen chalk-marks only; nothing official' },
            ],
          },
        ],
        entrantLine: '"The Fort office sahibs ordered from the Byculla kitchen, sahib. The food does not know about wards." Sixty tiffins ride his head-tray, each one somebody\'s lunch.',
        ruleIds: ['rn2_ward', 'rn2_seal', 'rn2_expiry'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Byculla pass, Fort gate, waved through. Sixty lunches arrive warm.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"Byculla pass, Byculla streets." He tilts the tray onto one shoulder and trots off toward the long way round.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'You detain a dabbawala. Sixty office clerks eat nothing at noon and each of them learns the name of the checkpost responsible. Bomanji writes it down with an air of private grief.',
          },
        },
      },
      {
        id: 'n2_c5',
        entrantName: 'Dinshaw Gandhi',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Tradesman\'s Transit Pass, watch repair',
            fields: [
              { label: 'Name', value: 'Dinshaw Gandhi' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'April 1942' },
              { label: 'Reverse', value: 'Fee receipt stamp, two annas' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"The Fort\'s watches lose three minutes a week between them, sahib. I am the man who collects them."',
        ruleIds: ['rn2_seal', 'rn2_expiry', 'rn2_ward', 'rn2_fee'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order. He folds the stamped pass away with a watchmaker\'s exactness, thanks you with a tradesman\'s nod, and goes.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny a man whose papers are correct in every particular. He examines you with a watchmaker\'s patience, finds the fault, and leaves without naming it.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained on flawless papers. He spends the hour composing, aloud and in detail, the letter he will write to the newspaper. Pandurang releases him and reads you the rule on discretion with unusual emphasis.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'n2_e1',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { householdMin: 55 },
        next: 'n2_e1_low',
        text:
          'After dinner Leela produces a sheet of her school rough-work and holds it out. "Stamp it, Baba. I want to see how it is done." The rubber seal sits in your tunic pocket, heavier at home than it ever is at the desk.',
        choices: [
          {
            id: 'n2_e1_a',
            text: 'Let her press the stamp herself, once, on the scrap paper.',
            effects: { conscience: 5, crown: -2, note: 'She inks it, aligns it, and brings it down with both hands. APPROVED, over her own sums. She is delighted. You have just made the Empire a toy, which may be the most subversive act of your month.' },
            next: 'n2_e2',
          },
          {
            id: 'n2_e1_b',
            text: '"The seal is not a toy, Leela. It is the office."',
            effects: { crown: 3, conscience: -3, note: 'She returns to her sums. The stamp stays in your pocket, unpolluted by joy.' },
            next: 'n2_e2',
          },
        ],
      },
      {
        id: 'n2_e1_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'After dinner Leela produces a sheet of her school rough-work and holds it out. "Stamp it, Baba. I want to see how it is done." She has been very quiet at dinner. The rubber seal sits in your tunic pocket, heavier at home than it ever is at the desk. From the kitchen, the sound of Radha putting things away with more care than they need.',
        next: 'n2_e2',
        choices: [
          {
            id: 'n2_e1_a',
            text: 'Let her press the stamp herself, once, on the scrap paper.',
            effects: { conscience: 5, crown: -2, note: 'She inks it, aligns it, and brings it down with both hands. APPROVED, over her own sums. She is delighted. You have just made the Empire a toy, which may be the most subversive act of your month.' },
            next: 'n2_e2',
          },
          {
            id: 'n2_e1_b',
            text: '"The seal is not a toy, Leela. It is the office."',
            effects: { crown: 3, conscience: -3, note: 'She returns to her sums. The stamp stays in your pocket, unpolluted by joy.' },
            next: 'n2_e2',
          },
        ],
      },
      {
        id: 'n2_e2',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { rupeesMin: 5 },
        next: 'n2_e2_low',
        text:
          'On the landing, Domnic Menezes is fighting the water tap again. "It gives water at five in the morning and attitude the rest of the day," he says. "My Emil — my eldest — says the docks are loading war cargo now, day and night. More work, same pay, twice the shouting." He looks at your office tunic. "And you — one month in. Tell me, examiner, does the stamp get lighter, or do you just stop noticing?"',
        choices: [
          {
            id: 'n2_e2_a',
            text: '"Ask me in a year, Domnic."',
            effects: { note: 'He laughs, once, without much humour. "A year," he says. "I will hold you to it."' },
            next: 'n2_e3',
          },
          {
            id: 'n2_e2_b',
            text: '"It gets lighter. That is what worries me."',
            effects: { conscience: 3, note: 'He nods slowly, like a man who has had his suspicions professionally confirmed.' },
            next: 'n2_e3',
          },
        ],
      },
      {
        id: 'n2_e2_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'On the landing, Domnic Menezes is fighting the water tap again. "It gives water at five in the morning and attitude the rest of the day," he says. "My Emil — my eldest — says the docks are loading war cargo now, day and night. More work, same pay, twice the shouting." He holds his cup under the tap — it fills to barely a third. He looks at the cup, then at your office tunic. "And you — one month in. Tell me, examiner, does the stamp get lighter, or do you just stop noticing?"',
        next: 'n2_e3',
        choices: [
          {
            id: 'n2_e2_a',
            text: '"Ask me in a year, Domnic."',
            effects: { note: 'He laughs, once, without much humour. "A year," he says. "I will hold you to it."' },
            next: 'n2_e3',
          },
          {
            id: 'n2_e2_b',
            text: '"It gets lighter. That is what worries me."',
            effects: { conscience: 3, note: 'He nods slowly, like a man who has had his suspicions professionally confirmed.' },
            next: 'n2_e3',
          },
        ],
      },
      {
        id: 'n2_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'Second month, second wage, and the tin box has begun to believe in itself. You lie awake cataloguing the day: a borrowed face, a dead month, three rupees wrapped in a flower petal.',
        next: undefined,
      },
    ],
    householdCost: 10,
    salary: 12,
    summaryText: 'Day 2 ends. An ordinary month, correctly stamped. Household -{cost}. The queue will be back tomorrow; the queue is always back tomorrow.',
  },

  // ==========================================================================
  // DAY 3 — AUGUST 1942 — THE CALL GOES OUT
  // ==========================================================================
  {
    day: 3,
    date: 'August 1942',
    title: 'The Call Goes Out',
    post: 'Fort',
    intro:
      'Bombay, August 1942. Overnight the Movement\'s leadership has been swept into prison and the Movement itself declared unlawful. By morning the call has gone out anyway: the Empire must quit India. There are processions in Girangaon, lathis in Kalbadevi, and a new rulebook page on your desk, still smelling of ink.',
    morning: [
      {
        id: 'd2_m1',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The neighbour\'s wireless is on before dawn, loud enough to be a public service. Arrests in the night, all the big names, taken from their beds. Radha listens with her arms folded. On the landing, Domnic Menezes spits into the drain and says, to no one: "First they take the leaders. Then they take the sons. That is the order of it."',
        next: 'd2_m2',
      },
      {
        id: 'd2_m2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 55 },
        text:
          'Madhav has not come out of the room he shares with his temper. Radha sets your tea down with unusual care. "He will want to go to the maidan," she says. "Today or tomorrow. I am not asking you to stop him. I am asking you to tell me you will."',
        next: 'd2_m2_low',
        choices: [
          {
            id: 'd2_m2_a',
            text: 'Promise her. "He stays home. I will see to it."',
            effects: { flag: 'radha_promise', crown: 3, conscience: -3, note: 'A promise made to a wife about a grown son. It will be collected.' },
            next: 'd2_m3',
          },
          {
            id: 'd2_m2_b',
            text: '"He is nineteen, Radha. I can bar the door. I cannot bar his mind."',
            effects: { movement: 3, conscience: 3, note: 'She accepts this the way she accepts monsoon damage: without surprise, and without forgiving the rain.' },
            next: 'd2_m3',
          },
        ],
      },
      {
        id: 'd2_m2_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha does not bring the tea until Madhav\'s door is closed. When she sets it down she does not sit. "He will want to go to the maidan," she says. "Today or tomorrow." She wipes the counter that does not need wiping. "You know what I am asking."',
        choices: [
          {
            id: 'd2_m2_a',
            text: 'Promise her. "He stays home. I will see to it."',
            effects: { flag: 'radha_promise', crown: 3, conscience: -3, note: 'A promise made to a wife about a grown son. It will be collected.' },
            next: 'd2_m3',
          },
          {
            id: 'd2_m2_b',
            text: '"He is nineteen, Radha. I can bar the door. I cannot bar his mind."',
            effects: { movement: 3, conscience: 3, note: 'She accepts this the way she accepts monsoon damage: without surprise, and without forgiving the rain.' },
            next: 'd2_m3',
          },
        ],
      },
      {
        id: 'd2_m3',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { movementMin: 50 },
        text:
          'Madhav emerges at last, eyes red, voice too steady. "They took everyone by breakfast," he says. "And the call still went out by lunch, Baba. By lunch." He waits. He actually wants an answer.',
        next: 'd2_m3_low',
        choices: [
          {
            id: 'd2_m3_a',
            text: '"It is a thing people are. It is also a thing people are beaten for. Remember both."',
            effects: { movement: 5, conscience: 3, note: 'He nods slowly. You have given him honesty, which is what he asked for and not what he wanted.' },
            next: 'd2_m4',
          },
          {
            id: 'd2_m3_b',
            text: '"What it means is that the jails will be full by dinner. Eat your breakfast."',
            effects: { movement: -5, crown: 3, conscience: -5, note: 'He eats nothing. He looks at you like a document that failed inspection.' },
            next: 'd2_m4',
          },
        ],
      },
      {
        id: 'd2_m3_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav emerges at last, eyes red, voice too steady. "They took everyone by breakfast," he says. "The call still went out by lunch." He says it the way you\'d read a charge into the record — clear, documented. "By lunch, Baba." He waits, watching to see which way the stamp falls.',
        choices: [
          {
            id: 'd2_m3_a',
            text: '"It is a thing people are. It is also a thing people are beaten for. Remember both."',
            effects: { movement: 5, conscience: 3, note: 'He nods slowly. You have given him honesty, which is what he asked for and not what he wanted.' },
            next: 'd2_m4',
          },
          {
            id: 'd2_m3_b',
            text: '"What it means is that the jails will be full by dinner. Eat your breakfast."',
            effects: { movement: -5, crown: 3, conscience: -5, note: 'He eats nothing. He looks at you like a document that failed inspection.' },
            next: 'd2_m4',
          },
        ],
      },
      {
        id: 'd2_m4',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { crownMin: 55 },
        text:
          'Pandurang reads the new rules aloud in the tone of a man announcing rain he personally ordered. "The Movement is an unlawful body. Its literature is seditious material. Bearers are to be detained." He taps the page. "There will be discretion. There always is. Remember that discretion, like credit, is extended by this office and recalled by this office." Bomanji has gone the colour of old paper.',
        next: 'd2_m4_low',
      },
      {
        id: 'd2_m4_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang reads the new rules aloud without inflection. "The Movement is an unlawful body. Its literature is seditious material. Bearers are to be detained." He sets the page down. "Discretion," he says, "is a word for people who have earned it." He does not look at Bomanji. He looks at you. "The same office that extends it recalls it." Bomanji makes himself busy with a form.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'r2_ban', text: 'The Movement is an unlawful body. Its literature is seditious material — detain the bearer. Printed matter carried in bulk must bear the press censor\'s stamp, and the consignment note must match the permit\'s stated purpose.' },
      { id: 'r2_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'r2_curfew', text: 'Curfew is in force 9 p.m. to 6 a.m. Curfew passes are valid only within the ward named, whatever accompanying letters request.' },
      { id: 'r2_assembly', text: 'All permits for assemblies and processions issued before 8 August stand revoked.' },
      { id: 'r2_press', text: 'The Movement is an unlawful body. Its literature is seditious material — detain the bearer. Printed matter carried in bulk must bear the press censor\'s stamp, and the consignment note must match the permit\'s stated purpose.' },
      { id: 'r2_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
    ],
    cases: [
      {
        id: 'd2_c1',
        entrantName: 'Annasaheb Bhosle',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Printer\'s Trade Permit',
            fields: [
              { label: 'Name', value: 'Annasaheb Bhosle, job printer, Girangaon' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Stated purpose', value: 'Job printing — stationery, wedding cards, billheads' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Consignment Note',
            fields: [
              { label: 'Goods', value: 'Three hundred printed handbills, unbound' },
              { label: 'Text of handbill', value: '"The call has gone out — leave the Empire\'s service."' },
              { label: 'Press censor\'s stamp', value: 'None' },
            ],
            sealState: 'missing',
          },
        ],
        entrantLine: '"Three hundred sheets, examiner. You may read one — they all say the same thing." He has already set the satchel on the counter.',
        ruleIds: ['r2_ban', 'r2_press', 'r2_seal'],
        correct: 'detain',
        outcomes: {
          approve: {
            movement: 8,
            suspicion: 12,
            conscience: 5,
            text: 'You stamp the trade permit and slide the satchel back under the grille. Three hundred handbills walk into the Fort ward on your signature. Bhosle takes the satchel and goes.',
          },
          deny: {
            crown: 2,
            movement: -3,
            conscience: -5,
            text: 'You deny the permit and let him keep the satchel. He goes.',
          },
          detain: {
            crown: 5,
            movement: -8,
            conscience: -10,
            flag: 'detained_printer',
            text: 'The warder takes him. Bhosle does not resist; he looks back once, not at you but at the stamp in your hand. Pandurang notes the interception.',
          },
        },
      },
      {
        id: 'd2_c2',
        entrantName: 'Mary Ferreira',
        portraitBg: 'office',
        documents: [
          {
            kind: 'curfew',
            title: 'Curfew Pass, hospital night staff',
            fields: [
              { label: 'Name', value: 'Mary Ferreira, staff nurse' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Valid until', value: 'October 1942' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Nurse\'s Service Card',
            fields: [
              { label: 'Name', value: 'Mary Ferreira' },
              { label: 'Posting', value: 'Byculla Hospital, fever ward, nights' },
              { label: 'Valid until', value: 'December 1942' },
            ],
          },
          {
            kind: 'letter',
            title: 'Duty Roster Letter',
            fields: [
              { label: 'Salutation', value: '"To whom it concerns —"' },
              { label: 'From', value: 'Matron, Byculla Hospital' },
              { label: 'Body', value: 'Requests that Nurse Ferreira be passed by the Fort gate on night duty; the ward is short two nurses and the Fort gate is twenty minutes closer.' },
            ],
          },
        ],
        entrantLine: '"Fever ward, short two nurses. My pass says Byculla but the Fort gate saves twenty minutes."',
        ruleIds: ['r2_curfew', 'r2_seal', 'r2_names'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            movement: 3,
            conscience: 5,
            text: 'Wrong ward. You pass her anyway. She does not thank you; she is already running.',
          },
          deny: {
            crown: 3,
            conscience: -5,
            text: '"The Byculla gate, nurse." She looks at you for exactly as long as it takes to hate you efficiently, then goes. Tonight the ward will be short two nurses.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'You detain a night nurse in August 1942. Pandurang releases her within the hour and stares at you across the office for a long, instructional moment.',
          },
        },
      },
      {
        id: 'd2_moral_schoolmaster',
        entrantName: 'Vithoba Gurav',
        portraitBg: 'office',
        documents: [
          {
            kind: 'identity',
            title: 'Identity Paper, retired schoolmaster',
            fields: [
              { label: 'Name', value: 'Vithoba Gurav, sixty-eight, retired' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
              { label: 'Pension record', value: 'Municipal school service, thirty years' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Folded Handbill',
            fields: [
              { label: 'Found', value: 'Wrapped around a quarter-measure of channa, bought from a boy at the station' },
              { label: 'Heading', value: '"Leave the Empire\'s service — the call has gone out"' },
              { label: 'Press censor\'s stamp', value: 'None' },
            ],
            sealState: 'missing',
          },
        ],
        entrantLine: 'He unwraps it in front of you. "The boy wrapped my channa in it, sahib. I was going to read it after eating." He offers you a peanut.',
        ruleIds: ['r2_ban', 'r2_seal', 'r2_names'],
        correct: 'detain',
        outcomes: {
          approve: {
            movement: 5,
            suspicion: 8,
            conscience: 5,
            text: 'You fold the handbill small and hand it back inside the channa twist, the way it came. "Eat first. Read nothing." He goes. The Empire\'s intelligence reports will never contain the phrase "peanut."',
          },
          deny: {
            crown: 2,
            conscience: -3,
            movement: -3,
            text: 'You confiscate the handbill and send him home with the channa.',
          },
          detain: {
            crown: 5,
            conscience: -10,
            movement: -5,
            text: 'You apply the rule to a sixty-eight-year-old with a snack. The warder takes him; he is bewildered, then courteous. Pandurang is pleased.',
          },
        },
      },
      {
        id: 'd2_c3',
        entrantName: 'Vasant Gokhale',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Student Transit Pass',
            fields: [
              { label: 'Name', value: 'Vasant Gokhale, nineteen, Elphinstone student' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'June 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Student Identity Paper',
            fields: [
              { label: 'Name', value: 'Vasant Gokhale' },
              { label: 'College', value: 'Elphinstone College' },
              { label: 'Photograph', value: 'Affixed, principal\'s stamp' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Folded Leaflet',
            fields: [
              { label: 'Found', value: 'Between the pages of a geometry textbook, folded small' },
              { label: 'Heading', value: '"The Empire must quit India"' },
              { label: 'Press censor\'s stamp', value: 'None' },
            ],
            sealState: 'missing',
          },
        ],
        entrantLine: '"Only college today, sahib. Truly." You know this boy. He eats at your table some Sundays. Madhav calls him "Vasu."',
        ruleIds: ['r2_ban', 'r2_seal', 'r2_names'],
        correct: 'detain',
        outcomes: {
          approve: {
            movement: 10,
            suspicion: 10,
            conscience: 5,
            text: 'You close the textbook and hand it back with the pass. "Lose the bookmark," you say, not quietly enough. Vasu walks. Bomanji\'s pen stops moving for a moment, then starts again. Nothing was written down. Something was recorded.',
          },
          deny: {
            crown: 2,
            movement: -5,
            conscience: -3,
            text: 'You deny the pass and drop the leaflet in the stove-box under the desk. "Go home, Vasu." He goes.',
          },
          detain: {
            crown: 5,
            movement: -10,
            conscience: -15,
            flag: 'detained_vasu',
            text: 'The rule says the bearer of seditious material is detained. You apply it to a boy who has eaten your rice. He does not cry until the warder turns him around. Madhav will hear of this by dinner. So will Radha.',
          },
        },
      },
      {
        id: 'd2_c4',
        entrantName: 'Dattaram Karmarkar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Assembly Permit, millworkers\' welfare meeting',
            fields: [
              { label: 'Organizer', value: 'Dattaram Karmarkar' },
              { label: 'Issued', value: '2 August 1942' },
              { label: 'Purpose', value: 'Welfare meeting — distribution of spectacles' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"It is a welfare meeting, sahib. We distribute spectacles."',
        ruleIds: ['r2_assembly', 'r2_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 8,
            movement: 3,
            text: 'You pass a revoked permit. Whether they distribute spectacles or pamphlets, it happens under your stamp.',
          },
          deny: {
            crown: 3,
            text: '"Revoked on the eighth. Reapply after the emergency." He folds the permit with terrible gentleness, like a man folding a flag, and goes to tell forty waiting men there will be no spectacles.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'Detained for holding a revoked permit. The welfare meeting becomes a police file. Pandurang sighs at the paperwork your zeal has generated.',
          },
        },
      },
      {
        id: 'd2_c5',
        entrantName: 'Fatima Sheikh',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Family Transit Pass',
            fields: [
              { label: 'Name', value: 'Fatima Sheikh, widow, travelling with two children' },
              { label: 'Route', value: 'Fort to Byculla' },
              { label: 'Valid until', value: 'September 1942' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Paper',
            fields: [
              { label: 'Name', value: 'Fatima Sheikh' },
              { label: 'Children', value: 'Two, listed by name and age' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Only to my sister\'s in Byculla, sahib. The children have eaten; they will be quiet." The children are clean, hungry, and silent in the way that means they have been trained for checkpoints.',
        ruleIds: ['r2_seal', 'r2_curfew', 'r2_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            text: 'Papers in order. The stamp comes down and the smaller child flinches at the sound. They pass through.',
          },
          deny: {
            crown: -3,
            conscience: -5,
            movement: -3,
            text: 'You deny a widow with valid papers. She picks up the smaller child and goes without a word.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'You detain her. For nothing. The children wait outside the post until she is released at dusk, and the older one does not cry, which is the worst part.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'd2_e1',
        bg: 'curfew',
        speaker: 'Narrator',
        text:
          'Curfew. Madhav has not come home. Radha fries onions she does not need. At half past nine there are feet on the stairs — too heavy to be Madhav — and then past the door, and the feet of the whole chawl seem to hold their breath until the stairs go quiet again.',
        next: 'd2_e2',
      },
      {
        id: 'd2_e2',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { flagNot: 'detained_printer' },
        text:
          'He comes in at ten, through the window he thinks you do not know about, and finds you at the table with the lamp lit. There is brick dust on his shoulder. "The maidan was full," he says. "They charged it. I am going again tomorrow." He is not defying you. He is informing you, the way you would inform a colleague.',
        next: 'd2_e2_low',
        choices: [
          {
            id: 'd2_e2_a',
            text: 'Bar the door. "Tomorrow you do not leave this room."',
            effects: { movement: -8, conscience: -8, crown: 5, flag: 'madhav_forbidden', note: 'He says nothing at all. He looks at the door, then at you, and something in the room is re-districted forever.' },
            next: 'd2_e2b',
          },
          {
            id: 'd2_e2_b',
            text: '"If you go, go with your eyes open. Come home before the lathis, not after."',
            effects: { movement: 8, conscience: 5, suspicion: 5, flag: 'madhav_blessed', note: 'He grips your shoulder — the first time he has touched you like an equal. Radha, in the doorway, closes her eyes.' },
            next: 'd2_e2b',
          },
          {
            id: 'd2_e2_c',
            text: '"Give me what is in your pocket. I will burn it. Then we will not speak of tonight."',
            effects: { movement: -3, conscience: -3, note: 'He hands over a single folded handbill. You burn it in the stove. The smoke smells like every other compromise you have ever made.' },
            next: 'd2_e2b',
          },
        ],
      },
      {
        id: 'd2_e2_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'He comes in at ten, through the window he thinks you do not know about, and finds you at the table with the lamp lit. There is brick dust on his shoulder and a pause before he uses it. "The maidan was full," he says. "They charged it." He sets down something he was carrying. "Bhosle\'s family knows by now. The whole ward knows." He looks at the lamp. "I am going again tomorrow."',
        choices: [
          {
            id: 'd2_e2_a',
            text: 'Bar the door. "Tomorrow you do not leave this room."',
            effects: { movement: -8, conscience: -8, crown: 5, flag: 'madhav_forbidden', note: 'He says nothing at all. He looks at the door, then at you, and something in the room is re-districted forever.' },
            next: 'd2_e2b',
          },
          {
            id: 'd2_e2_b',
            text: '"If you go, go with your eyes open. Come home before the lathis, not after."',
            effects: { movement: 8, conscience: 5, suspicion: 5, flag: 'madhav_blessed', note: 'He grips your shoulder — the first time he has touched you like an equal. Radha, in the doorway, closes her eyes.' },
            next: 'd2_e2b',
          },
          {
            id: 'd2_e2_c',
            text: '"Give me what is in your pocket. I will burn it. Then we will not speak of tonight."',
            effects: { movement: -3, conscience: -3, note: 'He hands over a single folded handbill. You burn it in the stove. The smoke smells like every other compromise you have ever made.' },
            next: 'd2_e2b',
          },
        ],
      },
      {
        id: 'd2_e2b',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { rupeesMin: 10 },
        text:
          'Later, in the lull, Leela brings her school list and lays it beside your plate like a small manifest. New term: a geometry primer, two exercise books, the examination fee. Three rupees altogether. "Manjula\'s father paid on Monday," she reports, neutrally, a clerk entering a fact. Three rupees, after a month like this one. She watches you read the list the way you watch the queue read the ruleboard.',
        next: 'd2_e2b_low',
        choices: [
          {
            id: 'd2_e2b_a',
            text: 'Count out the three rupees. School is not where the economizing starts.',
            effects: { rupees: -3, household: 2, conscience: 3, note: 'Three rupees for a geometry primer and the fee. She folds the list away with a schoolgirl\'s exactness. Somewhere in the city the whole of August is on fire, and in this room a child has her books.' },
            next: 'd2_e3',
          },
          {
            id: 'd2_e2b_b',
            text: '"Share Manjula\'s primer this term. The fee can wait a fortnight."',
            effects: { household: -3, conscience: -3, note: '"Manjula sits three rows ahead," Leela says, not arguing, only entering the difficulty into the record. She copies her sums into an old ledger of yours that night, in the margins, around the Empire\'s arithmetic.' },
            next: 'd2_e3',
          },
        ],
      },
      {
        id: 'd2_e2b_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'Later, in the lull, Leela brings her school list and lays it beside your plate like a small manifest. New term: a geometry primer, two exercise books, the examination fee. Three rupees altogether. She sits down across from you. "Manjula\'s father paid on Monday," she says. Then: "Is there enough?" Not accusing. Asking. The way she would ask if the gas was on.',
        choices: [
          {
            id: 'd2_e2b_a',
            text: 'Count out the three rupees. School is not where the economizing starts.',
            effects: { rupees: -3, household: 2, conscience: 3, note: 'Three rupees for a geometry primer and the fee. She folds the list away with a schoolgirl\'s exactness. Somewhere in the city the whole of August is on fire, and in this room a child has her books.' },
            next: 'd2_e3',
          },
          {
            id: 'd2_e2b_b',
            text: '"Share Manjula\'s primer this term. The fee can wait a fortnight."',
            effects: { household: -3, conscience: -3, note: '"Manjula sits three rows ahead," Leela says, not arguing, only entering the difficulty into the record. She copies her sums into an old ledger of yours that night, in the margins, around the Empire\'s arithmetic.' },
            next: 'd2_e3',
          },
        ],
      },
      {
        id: 'd2_e3',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { flag: 'madhav_blessed' },
        text:
          'On the landing, later, Domnic Menezes is sitting on the stairs he is supposed to be washing. "Emil\'s at the docks hauling their cargo," he says. "Your boy is at the maidan. Different doors, same house." He picks up the mop. "I only count who comes home."',
        next: 'd2_e3_low',
      },
      {
        id: 'd2_e3_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'On the landing, later, Domnic Menezes is sitting on the stairs he is supposed to be washing. He makes room on the step without being asked. "Emil\'s at the docks," he says. "Different work than the maidan." He does not finish the thought. He picks up the mop. "Man can only hold so much in one room. I\'ve found that."',
        next: 'd2_e4',
      },
      {
        id: 'd2_e4',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The curfew has a sound after all: no lorries, no hawkers, only a dog somewhere near the mill gate and the neighbour\'s wireless crackling the All India Radio sign-off. Radha has left the lamp burning in the kitchen window.',
        next: undefined,
      },
    ],
    householdCost: 12,
    salary: 13,
    summaryText: 'Day 3 ends. The call has gone out and cannot be recalled. Household -{cost}. Somewhere in the dark, your son is deciding what kind of man to become.',
  },

  // ==========================================================================
  // DAY 4 — SEPTEMBER 1942 — THE QUIET AFTER (ordinary day)
  // ==========================================================================
  {
    day: 4,
    date: 'September 1942',
    title: 'The Quiet After',
    post: 'Fort',
    intro:
      'Bombay, September 1942. The August weeks are over. The processions have been processed, the jails are full past design, and the city has gone quiet the way a household goes quiet after a death — not calm, just counting. The queue is back at the grille, thinner and politer, and the rules have not been un-written merely because they were obeyed.',
    morning: [
      {
        id: 'n4_m1',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The maidan is empty on a Sunday, which nobody living remembers. The mills run at half-heart; half the looms\' usual hands are behind wire at the detention camps, and the other half work quietly, like men in a sickroom. On the stairs, somebody has chalked QUIT INDIA in letters a child could read, and somebody else has washed it off badly, so that it reads as a ghost.',
        next: 'n4_m2',
      },
      {
        id: 'n4_m2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { suspicionMax: 29 },
        text:
          'Madhav has stopped arguing, which Radha finds more frightening than the arguing. He copies out lists at the table all evening — names, addresses, who is taken, who is still outside — and folds them small. "He says it is relief work," Radha says. "Families of the arrested. Food parcels." She dries a cup that is already dry. "Keshav. Relief work is what they called it in the papers before they arrested them for it."',
        next: 'n4_m2_low',
        choices: [
          {
            id: 'n4_m2_a',
            text: '"Feeding prisoners\' families is not sedition, even now."',
            effects: { movement: 3, conscience: 3, note: '"Not yet," Radha says, and puts the cup down with a click like a full stop.' },
            next: 'n4_m3',
          },
          {
            id: 'n4_m2_b',
            text: '"Then he should copy his lists somewhere other than my table."',
            effects: { crown: 3, conscience: -5, note: 'Radha says nothing. That evening Madhav copies his lists at Vasu\'s empty desk at the school, and the table at home is bare in a new way.' },
            next: 'n4_m3',
          },
        ],
      },
      {
        id: 'n4_m2_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Madhav has stopped arguing. The lists come out after supper — names, addresses, who is taken — and he folds them before Radha can read them. She does not ask to. "He calls it relief work," she says. She does not dry the cup. She puts it down on the shelf and her hand stays there. "They arrested the last three people who called it that."',
        next: 'n4_m3',
        choices: [
          {
            id: 'n4_m2_a',
            text: '"Feeding prisoners\' families is not sedition, even now."',
            effects: { movement: 3, conscience: 3, note: '"Not yet," Radha says, and puts the cup down with a click like a full stop.' },
            next: 'n4_m3',
          },
          {
            id: 'n4_m2_b',
            text: '"Then he should copy his lists somewhere other than my table."',
            effects: { crown: 3, conscience: -5, note: 'Radha says nothing. That evening Madhav copies his lists at Vasu\'s empty desk at the school, and the table at home is bare in a new way.' },
            next: 'n4_m3',
          },
        ],
      },
      {
        id: 'n4_m3',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { crownMin: 60 },
        text:
          'Pandurang pins a clean sheet over the August rule page like a shroud over a face. "The emergency continues," he says. "The enthusiasm for it, however, is over. Detention figures for this office were — adequate. Adequate is not a target, it is a climate." He adjusts the sheet by one millimetre. "Also: a woman came to the gate yesterday asking after the printer Bhosle. Such enquiries are to be referred to the ward office, not answered by examiners. We stamp paper. We do not answer questions."',
        next: 'n4_m3_low',
      },
      {
        id: 'n4_m3_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang pins a clean sheet over the August rule page. He does not look at Keshav directly. "The emergency continues," he says. "The enthusiasm for it is over. Detention figures for this office were — adequate. Adequate is not a target, it is a floor." He adjusts the sheet by one millimetre, then adjusts it back. "A woman came to the gate yesterday asking after the printer Bhosle. She was answered. That is not to happen again. We stamp paper. We do not tell people what happened to their printer."',
        next: undefined,
      },
    ],
    rules: [
      { id: 'rn4_ban', text: 'The Movement is an unlawful body. Its literature is seditious material — detain the bearer. Printed matter carried in bulk must bear the press censor\'s stamp, and the consignment note must match the permit\'s stated purpose.' },
      { id: 'rn4_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'rn4_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'rn4_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'rn4_press', text: 'The Movement is an unlawful body. Its literature is seditious material — detain the bearer. Printed matter carried in bulk must bear the press censor\'s stamp, and the consignment note must match the permit\'s stated purpose.' },
      { id: 'rn4_curfew', text: 'Curfew is in force 9 p.m. to 6 a.m. Curfew passes are valid only within the ward named, whatever accompanying letters request.' },
    ],
    cases: [
      {
        id: 'n4_c1',
        entrantName: 'Janabai Kamat',
        portraitBg: 'office',
        documents: [
          {
            kind: 'curfew',
            title: 'Curfew Pass, seamstress on piece-work',
            fields: [
              { label: 'Name', value: 'Janabai Kamat, widow' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'December 1942' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Cantonment Work Chit',
            fields: [
              { label: 'Salutation', value: '"To the gate examiner —"' },
              { label: 'From', value: 'Clothing contractor, cantonment' },
              { label: 'Body', value: 'Kamat, J. is engaged on officers\' shirts, piece-work, collected after dark within Fort ward.' },
            ],
          },
        ],
        entrantLine: '"The cloth does not wait for morning, sahib. Neither does the rent." Her bundle of half-sewn shirts rides her hip like a second spine.',
        ruleIds: ['rn4_curfew', 'rn4_seal', 'rn4_expiry', 'rn4_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order. She goes through with her bundle of half-sewn shirts, already stitching in her head.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny a valid curfew pass because today every face looks like August. She will lose the piece-work contract by Friday.',
          },
          detain: {
            crown: -5,
            conscience: -8,
            suspicion: 5,
            text: 'Detained on a valid pass. The warder, who has processed three hundred August arrests, looks at her, looks at the pass, and asks you very politely whether you are well.',
          },
        },
      },
      {
        id: 'n4_moral_curfew_ward',
        entrantName: 'Rambha Kadam',
        portraitBg: 'office',
        documents: [
          {
            kind: 'curfew',
            title: 'Curfew Pass, dependent relative',
            fields: [
              { label: 'Name', value: 'Rambha Kadam, widow' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: '31 August 1942' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Neighbour\'s Letter',
            fields: [
              { label: 'Salutation', value: '"To any officer of the gate —"' },
              { label: 'From', value: 'Neighbours of S. Kadam, Mazgaon' },
              { label: 'Body', value: 'The boy\'s fever turned on Sunday. He asks for his mother. Come by night if you can; the days are watched.' },
            ],
          },
        ],
        entrantLine: '"One day dead, sahib. The pass, I mean. The boy is not dead yet." She puts both papers on the counter. "He is in Mazgaon. I have his milk money from the sale of the cot."',
        ruleIds: ['rn4_expiry', 'rn4_curfew', 'rn4_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 5,
            movement: 3,
            text: 'Expired by a day; you stamp it. She is through the gate and running before the ink sets.',
          },
          deny: {
            crown: 3,
            conscience: -8,
            text: '"Expired on the last of August. The ward office renews in the morning." She stands a moment, then turns toward the night buses that will not take her without the pass.',
          },
          detain: {
            crown: -3,
            conscience: -10,
            suspicion: 3,
            text: 'Detained for a one-day-dead curfew pass, with a sick son in Mazgaon. She is released at first light. The neighbours\' second letter reaches the post before she does.',
          },
        },
      },
      {
        id: 'n4_c2',
        entrantName: 'Ramchandra Sawant',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Transit Pass, despatch clerk',
            fields: [
              { label: 'Name', value: 'Ramchandra Sawant' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'March 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Paper',
            fields: [
              { label: 'Name', value: 'Ramchandra Savant' },
              { label: 'Occupation', value: 'Despatch clerk' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"The ward office wrote it so, sahib. Twelve years I have carried it. Please — I have a mother, an unmarried sister—" He is grey with fear before you have said a word.',
        bribeOffer: 'He slides five rupees across the file, folded small, like a note passed in class. "For the correction, sahib. However it may be corrected."',
        ruleIds: ['rn4_names', 'rn4_seal'],
        correct: 'deny',
        bribe: { amount: 5 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'One vowel between the two documents; you stamp it. He weeps with gratitude, which is embarrassing for everyone within earshot.',
          },
          deny: {
            crown: 3,
            conscience: -5,
            text: '"The names must match exactly. Have the ward office correct the paper." He goes away to queue three days to fix a vowel.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'Detained over a vowel. Even in the month after August, this draws looks. He is released at dusk, still apologizing, a man terrified of being a bother in his own arrest.',
          },
          bribe: {
            household: 5,
            conscience: -4,
            note: 'Five rupees, folded small. The price of a vowel, payable to the man who noticed it.',
            text: 'The folded five vanishes into your desk drawer. The stamp comes down; he thanks you four times.',
          },
        },
      },
      {
        id: 'n4_c3',
        entrantName: 'Master Dinanath',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Teacher\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Master Dinanath, municipal school, Fort ward' },
              { label: 'Stated purpose', value: 'School books for municipal classes' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Consignment Note',
            fields: [
              { label: 'Goods', value: 'Two hundred unbound arithmetic primers, one crate' },
              { label: 'Contents', value: 'Addition, subtraction, long division' },
              { label: 'Press censor\'s stamp', value: 'None' },
            ],
            sealState: 'missing',
          },
        ],
        entrantLine: '"Sums, examiner. Addition. Subtraction. Long division. I defy the censor to find sedition in a remainder."',
        ruleIds: ['rn4_press', 'rn4_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 3,
            movement: 3,
            text: 'No censor\'s stamp; through anyway. Two hundred children will learn long division on paper the censor never saw. Somewhere Pandurang\'s sheet says "printed matter, bulk, unchecked," and your initials are underneath it.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"Bulk print needs the censor\'s stamp. Get it stamped and return." He carries the crate off, muttering multiplication tables like curses.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'Detained with two hundred arithmetic primers. The duty officer reads one twice, looking for code, and finds only long division. Master Dinanath is released with his crate and a new opinion of the Empire, which he will share with four classes of nine-year-olds.',
          },
        },
      },
      {
        id: 'n4_c4',
        entrantName: 'Fakir Mahomed',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Tonga Driver\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Fakir Mahomed' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'July 1942' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: 'His horse is hitched outside, ribs showing. "In August nobody renewed anything, sahib. In August we were busy with other matters."',
        ruleIds: ['rn4_expiry', 'rn4_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Two months dead, stamped alive. He flicks the reins and the horse does its best.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"Expired in July. Renew it." He nods — he expected it — and leads the horse away on foot, since a horse cannot renew anything either.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for an expired tonga pass. The horse is impounded as "connected property" and eats better in the police lines than it has in a month, which is the only defensible outcome of the whole transaction.',
          },
        },
      },
      {
        id: 'n4_c5',
        entrantName: 'Perin Bharucha',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Dispenser\'s Transit Pass, pharmacy assistant',
            fields: [
              { label: 'Name', value: 'Perin Bharucha' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'June 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Pharmacy Indent',
            fields: [
              { label: 'Salutation', value: '"To the examiner, Fort gate —"' },
              { label: 'From', value: 'Fort Pharmacy, licensed chemists' },
              { label: 'Body', value: 'Bearer, P. Bharucha, is authorised to collect the six tinctures listed below for dispensary stock.' },
            ],
          },
        ],
        entrantLine: 'A basket of tincture bottles wrapped in straw. "Yes, the pass is current. Yes, the indent is signed. What next?" — the bored voice of a woman who has been examined by experts.',
        ruleIds: ['rn4_seal', 'rn4_expiry', 'rn4_curfew', 'rn4_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order. She counts the bottles twice before leaving — not because she doubts your stamp, but because she doubts everything, professionally.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny her on nothing. She looks at the stamp, then at you, and says, "Ah. One of those days," and goes to queue again tomorrow. The pharmacy runs short of tincture for a week.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained with a basket of medicine on a clean pass. The chemist telephones the ward office; the ward office telephones Pandurang; Pandurang releases her and enters something in the small book, unhurried, like a man planting a tree.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'n4_e1',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { movementMin: 60 },
        text:
          'Madhav is copying his lists again — the families of the taken, who needs rice, who needs bail money, who needs only to be remembered. He looks up. "Baba. In August, at your post — did any of them come through your desk? The ones they took." He is not accusing. He actually wants an answer.',
        next: 'n4_e1_low',
        choices: [
          {
            id: 'n4_e1_a',
            text: 'Tell him the truth, whatever August held.',
            effects: { conscience: 5, movement: 3, note: 'He writes nothing down. Some entries he keeps in his head, where the files cannot find them.' },
            next: 'n4_e2',
          },
          {
            id: 'n4_e1_b',
            text: '"My desk is not your business. Your lists are not mine. Let us keep it so."',
            effects: { crown: 3, conscience: -3, note: 'He nods and folds the lists smaller. You have built a wall with an honest door in it, and you both pretend not to see the door.' },
            next: 'n4_e2',
          },
        ],
      },
      {
        id: 'n4_e1_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav is copying his lists again — he turns them face-down when he hears the stairs. He turns them back when he sees it is Keshav, then looks at that for a moment. "Baba. In August — at the gate. Did any of them — the ones they took—" He stops. Starts again. "I have a name. I only want to know if they went through."',
        next: 'n4_e2',
        choices: [
          {
            id: 'n4_e1_a',
            text: 'Tell him the truth, whatever August held.',
            effects: { conscience: 5, movement: 3, note: 'He writes nothing down. Some entries he keeps in his head, where the files cannot find them.' },
            next: 'n4_e2',
          },
          {
            id: 'n4_e1_b',
            text: '"My desk is not your business. Your lists are not mine. Let us keep it so."',
            effects: { crown: 3, conscience: -3, note: 'He nods and folds the lists smaller. You have built a wall with an honest door in it, and you both pretend not to see the door.' },
            next: 'n4_e2',
          },
        ],
      },
      {
        id: 'n4_e2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 15 },
        text:
          'Radha reads the bazaar prices off her fingertips like bad news from the front. "Rice up again. Kerosene up. The washerwoman wants an extra anna because her son was taken in August and she has his children now." She pauses. "Everyone\'s arithmetic has a new column this year, Keshav. Even ours. Especially ours."',
        next: 'n4_e2_low',
      },
      {
        id: 'n4_e2_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha reads the bazaar prices off her fingertips the way she has been reading them for three months, in the same order, as if the list does not change by itself when her back is turned. "Rice up again. Kerosene up. The washerwoman wants an extra anna — her son was taken in August and she has his children now." She sets her hand flat on the table. "Keshav. Everyone has a new column this year. Ours has been filling in for a while now."',
        next: 'n4_e2b',
      },
      {
        id: 'n4_e2b',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 15 },
        text:
          'There is one more column. A letter came from Pen: Radha\'s mother\'s cough has gone past home remedies, and the vaid there wants five rupees for the medicine and the visit. Radha recites this without inflection, the way she recites bazaar prices. "She carried me through two fevers and a monsoon," she says. "I am not asking, Keshav. I am entering it in the ledger. What we do with the entry is ours."',
        next: 'n4_e2b_low',
        choices: [
          {
            id: 'n4_e2b_a',
            text: 'Send the five rupees by Friday\'s post.',
            effects: { rupees: -5, household: 2, conscience: 3, note: 'Five rupees in a money-order envelope, address written in Radha\'s steadiest hand. She does not thank you. It was never a favour; it was the debt coming due.' },
            next: 'n4_e3',
          },
          {
            id: 'n4_e2b_b',
            text: '"Next month. After the rent. The vaid will keep."',
            effects: { household: -3, conscience: -4, note: 'Radha closes the letter back into its fold. "The cough will also keep," she says, evenly, and the sentence stands in the room a long time after she has left it.' },
            next: 'n4_e3',
          },
        ],
      },
      {
        id: 'n4_e2b_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'There is one more column. A letter came from Pen: Radha\'s mother\'s cough has gone past home remedies, and the vaid there wants five rupees. Radha folds the letter before she reads the amount aloud, then unfolds it. She recites it flat, the way she recites kerosene prices. "She carried me through two fevers and a monsoon. I know what is in the box, Keshav. I am not asking. I am only telling you, so you know too."',
        next: 'n4_e3',
        choices: [
          {
            id: 'n4_e2b_a',
            text: 'Send the five rupees by Friday\'s post.',
            effects: { rupees: -5, household: 2, conscience: 3, note: 'Five rupees in a money-order envelope, address written in Radha\'s steadiest hand. She does not thank you. It was never a favour; it was the debt coming due.' },
            next: 'n4_e3',
          },
          {
            id: 'n4_e2b_b',
            text: '"Next month. After the rent. The vaid will keep."',
            effects: { household: -3, conscience: -4, note: 'Radha closes the letter back into its fold. "The cough will also keep," she says, evenly, and the sentence stands in the room a long time after she has left it.' },
            next: 'n4_e3',
          },
        ],
      },
      {
        id: 'n4_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The quiet after is not quiet; it is everyone counting. The Empire counts its detentions, the Movement counts its missing, Radha counts the tin box. In your desk drawer at the office, five rupees sit folded small, waiting to become rice.',
        next: undefined,
      },
    ],
    householdCost: 12,
    salary: 13,
    summaryText: 'Day 4 ends. The quiet after holds. Household -{cost}. The jails are full, the maidan is empty, and the queue has learned to keep its voice down.',
  },

  // ==========================================================================
  // DAY 5 — 1943 — THE PRICE OF RICE
  // ==========================================================================
  {
    day: 5,
    date: 'March 1943',
    title: 'The Price of Rice',
    post: 'Fort',
    intro:
      'Bombay, March 1943. The famine in the countryside has reached the city the way famine always reaches cities: not as hunger, but as price. Rice has tripled. The ration queues start before dawn, and men with lorries and licences are getting rich in a war they never have to see.',
    morning: [
      {
        id: 'd3_m1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 12 },
        next: 'd3_m1_low',
        text:
          'Radha sets the rice jar between the breakfast things — half full — and recites it the way she recites a sum. "At this price it lasts three weeks. The ration shop has weevils and four hours in the queue. The black market has rice and no queue." She lids the jar and wipes the shelf. "You examine permits all day. This one is yours."',
        choices: [
          {
            id: 'd3_m1_a',
            text: 'Give her money for the black market. The children eat first.',
            effects: { rupees: -10, household: 5, conscience: -3, flag: 'blackmarket_rice', note: 'Ten rupees of black-market rice. It is somebody else\'s ration, bought twice. It cooks exactly the same. That is the horror of it.' },
            next: 'd3_m2',
          },
          {
            id: 'd3_m1_b',
            text: '"We queue. Like everyone."',
            effects: { household: 3, conscience: 5, note: 'Radha nods. She queues four hours the next day and does not once mention it, which is worse than mentioning it.' },
            next: 'd3_m2',
          },
        ],
      },
      {
        id: 'd3_m1_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha shows you the rice jar the way a doctor shows an X-ray. Half full. "At this price it lasts three weeks," she says. "The ration shop has weevils and a four-hour queue. The black market has rice and no queue — and ten rupees we do not have." She sets the lid on the jar. "You examine permits. Examine this."',
        choices: [
          {
            id: 'd3_m1_a',
            text: 'Give her money for the black market. The children eat first.',
            effects: { rupees: -10, household: 5, conscience: -3, flag: 'blackmarket_rice', note: 'Ten rupees of black-market rice. It is somebody else\'s ration, bought twice. It cooks exactly the same. That is the horror of it.' },
            next: 'd3_m2',
          },
          {
            id: 'd3_m1_b',
            text: '"We queue. Like everyone."',
            effects: { household: 3, conscience: 5, note: 'Radha nods. She queues four hours the next day and does not once mention it, which is worse than mentioning it.' },
            next: 'd3_m2',
          },
        ],
      },
      {
        id: 'd3_m2',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { householdMin: 65 },
        next: 'd3_m2_low',
        text:
          'Leela, ten now, has been reading the newspaper upside down while you read it. She finishes her breakfast before she asks. "Baba," she says, "if the ships can carry soldiers, why can they not carry rice?" She asks it the way she asks about sums — expecting that there is an answer, expecting you to have it.',
        choices: [
          {
            id: 'd3_m2_a',
            text: '"Ask the men who own the ships, Leela."',
            effects: { movement: 5, note: 'She files this away. You can almost hear the drawer close.' },
            next: 'd3_m3',
          },
          {
            id: 'd3_m2_b',
            text: '"Eat your breakfast and do your sums. The world is a problem for grown men."',
            effects: { movement: -3, conscience: -3, note: 'She obeys. Her obedience has begun to feel like a verdict.' },
            next: 'd3_m3',
          },
        ],
      },
      {
        id: 'd3_m2_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'Leela, eleven now, has been reading the newspaper upside down while you read it. She is quiet through most of breakfast. "Baba," she says at last, "if the ships can carry soldiers, why can they not carry rice?" She does not look up when she asks.',
        choices: [
          {
            id: 'd3_m2_a',
            text: '"Ask the men who own the ships, Leela."',
            effects: { movement: 5, note: 'She files this away. You can almost hear the drawer close.' },
            next: 'd3_m3',
          },
          {
            id: 'd3_m2_b',
            text: '"Eat your breakfast and do your sums. The world is a problem for grown men."',
            effects: { movement: -3, conscience: -3, note: 'She obeys. Her obedience has begun to feel like a verdict.' },
            next: 'd3_m3',
          },
        ],
      },
      {
        id: 'd3_m3',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        requires: { suspicionMin: 40 },
        text:
          'Bomanji comes in and settles at the far end of the bench. Cheerfully — he has a pleasant word for Ganpat about the queue. He does not sit near you until Pandurang arrives, and even then he finds a reason to check something across the room.',
        next: 'd3_m3_low',
      },
      {
        id: 'd3_m3_low',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'Bomanji arrives grey-faced; his ration card was stolen in the queue. Pandurang announces the new grain rules in his rain-announcing voice and adds, almost pleasantly: "The Food Department is watching the checkposts. Big men are moving big tonnage, and some of it walks through on small stamps." He looks at the ceiling while he says it. He is telling you there is money. He is telling you he knows you know.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'r3_ration', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'r3_altered', text: 'Altered or overwritten ration cards are void. Refer the bearer to the ration office.' },
      { id: 'r3_grain', text: 'Cargo manifests must match their licence: goods, tonnage, and destination. A false manifest is an offence — detain. Grain consignments over five maunds require a Food Department licence, current and countersigned, issued to a named licensee and not transferable — not even from the dead.' },
      { id: 'r3_manifest', text: 'Cargo manifests must match their licence: goods, tonnage, and destination. A false manifest is an offence — detain. Grain consignments over five maunds require a Food Department licence, current and countersigned, issued to a named licensee and not transferable — not even from the dead.' },
      { id: 'r3_destitute', text: 'Destitute persons without domicile papers are to be denied entry at the ward boundary and directed to relief camps — a village letter is not a domicile paper. Visitor passes for Blackwood House detainees are suspended until further order.' },
      { id: 'r3_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'r3_visits', text: 'Destitute persons without domicile papers are to be denied entry at the ward boundary and directed to relief camps — a village letter is not a domicile paper. Visitor passes for Blackwood House detainees are suspended until further order.' },
    ],
    cases: [
      {
        id: 'd3_c1',
        entrantName: 'Bai Rukmini',
        portraitBg: 'office',
        documents: [
          {
            kind: 'ration',
            title: 'Ration Card',
            fields: [
              { label: 'Name', value: 'Bai Rukmini' },
              { label: 'Household units', value: 'Reads 5, in pencil, over a rubbed-out 3' },
              { label: 'Grain quota', value: 'Rice 5 seers, atta 3 seers, sugar 8 tolas — weekly' },
              { label: 'Allotment', value: 'Husband on active service — army allotment marked' },
            ],
          },
          {
            kind: 'permit',
            title: 'Transit Permit',
            fields: [
              { label: 'Name', value: 'Bai Rukmini, four children, husband at the front' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'December 1943' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: 'The oldest child holds the baby. "Only rice, sahib. The shop has rice this week." The baby has stopped crying some days ago, in the way that is not a good sign.',
        ruleIds: ['r3_altered', 'r3_ration', 'r3_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 3,
            conscience: 5,
            suspicion: 6,
            text: 'You see the pencil mark. You stamp anyway. She does not perform gratitude — she is past performance — but the oldest child\'s shoulders drop an inch. Two extra units of rice.',
          },
          deny: {
            crown: 3,
            conscience: -8,
            text: '"The card is altered. Take it to the ration office." She nods once, gathers the children, and goes.',
          },
          detain: {
            crown: -3,
            conscience: -15,
            text: 'You detain a soldier\'s wife over a pencil mark. The warder himself hesitates. The children wait in the corridor in a line, by size, like the teeth of a comb.',
          },
        },
      },
      {
        id: 'd3_c2',
        entrantName: 'Chunilal Mehta',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Food Department Grain Licence',
            fields: [
              { label: 'Licensee', value: 'Chunilal Mehta, grain merchant' },
              { label: 'Valid until', value: 'June 1942' },
              { label: 'Countersignature page', value: 'Absent' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Cargo Manifest',
            fields: [
              { label: 'Consignment', value: 'Forty maunds of rice' },
              { label: 'Destination', value: 'Godown at Masjid' },
              { label: 'Wagons', value: 'Three lorries' },
            ],
          },
          {
            kind: 'other',
            title: 'Consignment Note',
            fields: [
              { label: 'Salutation', value: '"To the gate examiner —"' },
              { label: 'From', value: 'Mehta & Sons, grain merchants' },
              { label: 'Body', value: 'Forty maunds, godown stock, for city sale' },
              { label: 'Countersignature', value: 'None' },
            ],
          },
        ],
        entrantLine: '"Rice moves or it rots, examiner. The godowns are full and the queues are long. One of us is wrong."',
        bribeOffer: 'He lays twenty rupees on the file with two fingers, like a man dealing cards. "A storage fee," he says, smiling. "For your trouble."',
        ruleIds: ['r3_grain', 'r3_manifest'],
        correct: 'deny',
        bribe: { amount: 20, flagrant: true },
        outcomes: {
          approve: {
            suspicion: 8,
            text: 'Forty maunds of rice roll through on a dead licence, unbribed. The rice will sell at triple price by Thursday.',
          },
          deny: {
            crown: 4,
            conscience: 3,
            text: '"Licence expired. Countersignature missing." His smile does not move; only his eyes recalculate. "Another examiner, then," he says pleasantly.',
          },
          detain: {
            crown: 2,
            suspicion: 5,
            note: 'Detaining a connected man is never free.',
            text: 'You detain him. He is out by evening — a telephone call from the godown district to somewhere higher. Pandurang does not reprimand you. He simply says, "Mehta is known to the Food Department," and lets the sentence stand there like a trap.',
          },
          bribe: {
            household: 20,
            conscience: -10,
            flag: 'looted_bribe',
            note: 'FLAGRANT. Twenty rupees of famine money. This is not survival; this is profit.',
            text: 'Twenty rupees — a month of rice — folds into your desk drawer. Mehta\'s lorries pass. That week Radha serves rice without weevils and Leela asks where it came from.',
          },
        },
      },
      {
        id: 'd3_moral_tarabai_rice',
        entrantName: 'Tarabai Koli',
        portraitBg: 'office',
        documents: [
          {
            kind: 'ration',
            title: 'Ration Card',
            fields: [
              { label: 'Name', value: 'Tarabai Sawant' },
              { label: 'Household units', value: '3' },
              { label: 'Grain quota', value: 'Rice 3 seers, atta 2 seers — weekly' },
            ],
          },
          {
            kind: 'permit',
            title: 'Transit Permit',
            fields: [
              { label: 'Name', value: 'Tarabai Koli, wife of a Sassoon Dock fisherman' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'March 1944' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Sawant is my father\'s name, Koli my husband\'s — same woman, ask the dock. Ration office is a week and the shop has rice today." Two children wait at the rope line, holding each other\'s hands.',
        bribeOffer: 'She unwraps four rupees from a knot in her sari. "My bangle\'s worth, sahib. The bangle is already sold; this is what is left of it."',
        ruleIds: ['r3_ration', 'r3_seal'],
        correct: 'deny',
        bribe: { amount: 4 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 5,
            movement: 3,
            text: 'Sawant on the card, Koli on the permit; you stamp it. She gathers the children and goes for the rice queue.',
          },
          deny: {
            crown: 3,
            conscience: -8,
            text: '"The names must match. The ration office will amend it." She gathers the children with the efficiency of a woman folding nets, and goes.',
          },
          detain: {
            crown: -3,
            conscience: -12,
            text: 'You detain a fisherman\'s wife over a maiden name. The children wait at the rope line until a fisherwoman from her lane collects them, scolding you in a voice that needs no translation. The warder logs the detention and adds, in the margin, nothing. There is no column for it.',
          },
          bribe: {
            household: 4,
            conscience: -5,
            note: 'Four rupees — a sold bangle, the last of her dowry, for three seers of rice.',
            text: 'The bangle money crosses the file. The stamp comes down. She goes away with rice and without a dowry, and you go home with four rupees that used to be a circle of gold on a woman\'s wrist.',
          },
        },
      },
      {
        id: 'd3_c3',
        entrantName: 'Solly Master',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'permit',
            title: 'Harbour Transit Licence',
            fields: [
              { label: 'Licensee', value: 'Solly Master, shipping agent' },
              { label: 'Licence covers', value: 'Raw cotton bales, dockside storage, S.S. Verenor' },
              { label: 'Valid until', value: 'December 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Cargo Manifest',
            fields: [
              { label: 'Goods', value: '"Machine parts, drums, 12 tons"' },
              { label: 'Vessel', value: 'S.S. Verenor' },
              { label: 'Dock', value: 'Victoria Dock' },
            ],
          },
          {
            kind: 'other',
            title: 'Dock Receipt',
            fields: [
              { label: 'Received', value: 'Twelve tons, drums, from Master & Co. lorries' },
              { label: 'Clerk\'s chalk-mark', value: 'Drums — parts' },
              { label: 'Countersign', value: 'Dock clerk\'s initials, this morning' },
            ],
          },
        ],
        entrantLine: 'He smells of bay rum and money. "Cotton, parts — the dock clerks mix the words, examiner. It all burns the same in the end, eh?" He laughs.',
        bribeOffer: 'He slides eighteen rupees across the file, unhurried. "For the gate\'s swiftness. Time is money at a dock, sahib, and my money is good."',
        ruleIds: ['r3_manifest', 'r3_grain'],
        correct: 'detain',
        bribe: { amount: 18, flagrant: true },
        outcomes: {
          approve: {
            suspicion: 10,
            text: 'Licence says cotton; manifest says drums of machine parts. You stamp it anyway, unbribed. The lorries roll for the docks.',
          },
          deny: {
            crown: 3,
            text: '"Manifest and licence disagree. Take it back and make them agree." Master smiles like a man being told a mild joke. "Another gate, then," he says. It is not a threat. It is a weather report.',
          },
          detain: {
            crown: 5,
            flag: 'solly_held',
            text: 'You detain him and impound the manifest. The drums are opened at the depot: industrial solvent, unmanifested, meant for a ship\'s hold. Pandurang uses the word "commendable," then ruins it by adding, "and inconvenient."',
          },
          bribe: {
            household: 18,
            conscience: -10,
            suspicion: 8,
            flag: 'waved_solly',
            note: 'FLAGRANT. A looted bribe. You will meet these drums again.',
            text: 'Eighteen rupees. The drums go to the docks uninspected, and Solly Master touches his hatbrim to you like a man sealing a partnership.',
          },
        },
      },
      {
        id: 'd3_c4',
        entrantName: 'Kusum Bhosle',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Visitor Pass Application, Blackwood House',
            fields: [
              { label: 'Name', value: 'Kusum Bhosle, wife of a detainee' },
              { label: 'Detainee', value: 'Annasaheb Bhosle, printer, taken in the August weeks' },
              { label: 'Countersignature', value: 'Ward office countersignature present' },
            ],
          },
        ],
        entrantLine: '"My husband was taken in the August weeks, sahib. A printer. He printed words." She has brought him a shirt, folded, as if the shirt were the argument.',
        ruleIds: ['r3_visits', 'r3_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 5,
            suspicion: 8,
            text: 'You issue the pass against the suspension. She visits her husband. Somewhere a jailer notes the irregular stamp and files it.',
          },
          deny: {
            crown: 3,
            conscience: -10,
            text: '"Visits are suspended." She folds the shirt back into her bag with unbearable neatness.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            suspicion: 5,
            text: 'You detain a detainee\'s wife for asking. Bomanji actually puts his head in his hands. She is released at dusk with a warning, and the shirt is still folded.',
          },
        },
      },
      {
        id: 'd3_c5',
        entrantName: 'Genu and Laxmi Shinde',
        portraitBg: 'office',
        documents: [
          {
            kind: 'letter',
            title: 'Village Letter',
            fields: [
              { label: 'Salutation', value: '"To any kind officer of the city —"' },
              { label: 'From', value: 'Patil of Wadgaon village' },
              { label: 'Body', value: 'Genu Shinde and Laxmi Shinde are of this village. The fields have failed. They go to an aunt in Byculla.' },
              { label: 'Signed', value: 'A thumbprint; no seal, no stamp' },
            ],
            sealState: 'missing',
          },
        ],
        entrantLine: '"We walked twelve days, sahib. The camp at the maidan — people say there is sickness there. Is it true?" Walking skeletons in festival clothes — their best, saved for the city.',
        ruleIds: ['r3_destitute'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 8,
            suspicion: 8,
            text: 'You let them through on a village letter and a thumbprint. Bomanji says nothing and suddenly needs to check something across the room.',
          },
          deny: {
            crown: 3,
            conscience: -12,
            text: 'You direct them to the relief camp at the maidan, as the rule requires. They thank you. They walk toward the typhus, festival-bright.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            text: 'Detained for the crime of starving in the wrong district. The warder, a village man himself, handles them like glass and does not look at you at all.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'd3_e1',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { rupeesMin: 20 },
        next: 'd3_e1_low',
        text:
          'Madhav is twenty now, and the Movement that survived the jails is doing quieter work: relief kitchens in the mill districts, rice at cost when rice can be found. "We need fifteen rupees to open the Girangaon kitchen this week," he says. He does not say "give." He says, "I am asking my father, not the examiner." The tin box has more than fifteen. He is asking for fifteen. That gap is its own kind of message.',
        choices: [
          {
            id: 'd3_e1_a',
            text: 'Give him the fifteen rupees. All of it.',
            effects: { rupees: -15, movement: 10, conscience: 8, flag: 'relief_kitchen', note: 'Fifteen rupees out of the tin box. The kitchen opens. Two hundred people eat. Radha recalculates the month without a word of reproach, which is its own reproach.' },
            next: 'd3_e2',
          },
          {
            id: 'd3_e1_b',
            text: 'Give him five. "The rest feeds this house."',
            effects: { rupees: -5, movement: 5, conscience: 3, note: 'Five rupees out of the tin box. He takes it without complaint. The kitchen opens on half rations, which is still a kitchen.' },
            next: 'd3_e2',
          },
          {
            id: 'd3_e1_c',
            text: 'Refuse. "This house comes first. That is the whole of my politics."',
            effects: { movement: -8, conscience: -5, note: 'He nods, once, like a man filing a document. He finds the money somewhere else. You do not ask where. You are afraid he would tell you.' },
            next: 'd3_e2',
          },
        ],
      },
      {
        id: 'd3_e1_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav is twenty now, and the Movement that survived the jails is doing quieter work: relief kitchens in the mill districts, rice at cost when rice can be found. "We need fifteen rupees to open the Girangaon kitchen this week," he says. He does not say "give." He says, "I am asking my father, not the examiner." His voice is steady. He either does not know what is in the tin box or he is asking you to decide what matters more.',
        choices: [
          {
            id: 'd3_e1_a',
            text: 'Give him the fifteen rupees. All of it.',
            effects: { rupees: -15, movement: 10, conscience: 8, flag: 'relief_kitchen', note: 'Fifteen rupees out of the tin box. The kitchen opens. Two hundred people eat. Radha recalculates the month without a word of reproach, which is its own reproach.' },
            next: 'd3_e2',
          },
          {
            id: 'd3_e1_b',
            text: 'Give him five. "The rest feeds this house."',
            effects: { rupees: -5, movement: 5, conscience: 3, note: 'Five rupees out of the tin box. He takes it without complaint. The kitchen opens on half rations, which is still a kitchen.' },
            next: 'd3_e2',
          },
          {
            id: 'd3_e1_c',
            text: 'Refuse. "This house comes first. That is the whole of my politics."',
            effects: { movement: -8, conscience: -5, note: 'He nods, once, like a man filing a document. He finds the money somewhere else. You do not ask where. You are afraid he would tell you.' },
            next: 'd3_e2',
          },
        ],
      },
      {
        id: 'd3_e2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 15 },
        text:
          'After the children are asleep, Radha writes the week\'s list from memory, without opening the tin box first. She gets three lines in before she crosses one out and starts again.',
        next: 'd3_e2_low',
      },
      {
        id: 'd3_e2_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'After the children are asleep, Radha counts the tin box aloud, which she only does when she wants you to hear the silence between numbers. "We will manage," she says at last. "We always manage." She closes the tin box without counting it a third time.',
        next: 'd3_e3',
      },
      {
        id: 'd3_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The city hums its hungry hum. Somewhere in the godowns, rice sleeps under guard like money in a bank. From the lane below, a ration queue is already forming for morning.',
        next: undefined,
      },
    ],
    householdCost: 16,
    salary: 13,
    summaryText: 'Day 5 ends. Rice costs what it costs; it will cost more tomorrow. Household -{cost}. The jar is lighter.',
  },

  // ==========================================================================
  // DAY 6 — JULY 1943 — THE RAINS (ordinary day)
  // ==========================================================================
  {
    day: 6,
    date: 'July 1943',
    title: 'The Rains',
    post: 'Fort',
    weather: 'rain',
    intro:
      'Bombay, July 1943. The monsoon arrives the way it always arrives: as an invasion the city pretends to welcome. The famine does not pause for it. Rain gets into the godowns, into the chawls, into the paper itself — half the documents at the grille arrive as blue-veined pulp, and the office has been put on an ink ration.',
    morning: [
      {
        id: 'n6_m1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 10 },
        text:
          'The roof leak has moved in the night, with intent, to a position over the rice jar. Radha has deployed three vessels and a chemistry of curses. "The landlord says after the war," she reports. "The rain has not received his letter." She moves the jar to the bed and the bed three feet to the left, and the household\'s whole geography shifts to accommodate water.',
        next: 'n6_m1_low',
        choices: [
          {
            id: 'n6_m1_a',
            text: 'Spend Saturday on the roof yourself with tar and a borrowed ladder.',
            effects: { rupees: -2, household: 2, conscience: 5, note: 'Two rupees of tar and a Saturday tarring a roof in the rain, which is a paradox and also a marriage. The leak retreats to a corner over Domnic\'s landing. You hear about it for a month.' },
            next: 'n6_m2',
          },
          {
            id: 'n6_m1_b',
            text: '"Move the jar. The roof is the landlord\'s war."',
            effects: { crown: 2, conscience: -3, note: 'Radha moves the jar. The water wins by inches, nightly. Some wars you decline are lost anyway.' },
            next: 'n6_m2',
          },
        ],
      },
      {
        id: 'n6_m1_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The roof leak has moved in the night, with intent, to a position over the rice jar. Radha has moved the jar before speaking. Three vessels. "The landlord says after the war," she reports. "The jar cannot wait for after the war." She moves the bed three feet to the left, checks the jar\'s new position, moves it again. The household\'s whole geography rearranges itself around what cannot be replaced.',
        next: 'n6_m2',
        choices: [
          {
            id: 'n6_m1_a',
            text: 'Spend Saturday on the roof yourself with tar and a borrowed ladder.',
            effects: { rupees: -2, household: 2, conscience: 5, note: 'Two rupees of tar and a Saturday tarring a roof in the rain, which is a paradox and also a marriage. The leak retreats to a corner over Domnic\'s landing. You hear about it for a month.' },
            next: 'n6_m2',
          },
          {
            id: 'n6_m1_b',
            text: '"Move the jar. The roof is the landlord\'s war."',
            effects: { crown: 2, conscience: -3, note: 'Radha moves the jar. The water wins by inches, nightly. Some wars you decline are lost anyway.' },
            next: 'n6_m2',
          },
        ],
      },
      {
        id: 'n6_m2',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { crownMin: 60 },
        text:
          'Pandurang holds up the office ink bottle, which has developed a chalk line around its middle like floodmark. "Ink is a war material," he announces. "Stamps are to be dabbed, not pressed. Blotting paper is to be reused until it achieves transparency." He looks personally betrayed by the concept of absorption. Bomanji has already begun dabbing with the delicacy of a man feeding birds.',
        next: 'n6_m2_low',
      },
      {
        id: 'n6_m2_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang holds up the office ink bottle, which has developed a chalk line around its middle like floodmark. "Ink is a war material," he announces. "Stamps are to be dabbed, not pressed. Blotting paper is to be reused until it achieves transparency." He reads each instruction twice — once at the room, once at you specifically. He looks personally betrayed by the concept of absorption. Bomanji has already begun dabbing with the delicacy of a man feeding birds, which Pandurang allows without comment, which is its own comment.',
        next: 'n6_m3',
      },
      {
        id: 'n6_m3',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'Outside, the queue stands under sacks and banana leaves, holding their papers inside their shirts like infants. By the time each file reaches the grille it has been rained on twice: once by the sky, once by the man in front shaking out his turban. The first entrant of the day unwraps his documents from three layers of oiled cloth, and you think: this is the kind of man the rulebook was written by, if it had been written by the ruled.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'rn6_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'rn6_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'rn6_legible', text: 'Documents rendered illegible by rain or wear are void; the bearer must seek reissue at the ward office.' },
      { id: 'rn6_ration', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'rn6_grain', text: 'Cargo manifests must match their licence: goods, tonnage, and destination. A false manifest is an offence — detain. Grain consignments over five maunds require a Food Department licence, current and countersigned, issued to a named licensee and not transferable — not even from the dead.' },
    ],
    cases: [
      {
        id: 'n6_c1',
        entrantName: 'Shripad Velankar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Tradesman\'s Transit Pass, oiled-cloth seller',
            fields: [
              { label: 'Name', value: 'Shripad Velankar' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'November 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Booklet',
            fields: [
              { label: 'Name', value: 'Shripad Velankar' },
              { label: 'Registered trade', value: 'Oiled-cloth seller, Fort ward' },
              { label: 'Photograph', value: 'Affixed — and dry' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: 'His papers arrive dry inside a wrapper of his own merchandise. "Three layers, sahib. I sell the cloth; I should know." He waits while you read, with the serene confidence of a man whose product has just demonstrated itself.',
        ruleIds: ['rn6_seal', 'rn6_expiry', 'rn6_legible', 'rn6_ration'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order, and dry, which today is a double distinction. He offers you a square of oiled cloth "for the stamp, examiner — a stamp must not rust," and it is the first useful thing anyone has given the desk all year.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny dry, valid papers because the rain has put you in a refusing mood. He rewraps the documents with enormous patience, as though you were weather too.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained on valid papers. His oiled-cloth samples are logged as goods, and the detention cell gains its first dry floor in weeks. Bomanji refuses to meet your eye, which from Bomanji is a riot.',
          },
        },
      },
      {
        id: 'n6_c2',
        entrantName: 'Kassim Vora',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Fish Trader\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Kassim Vora, Sassoon Dock fleet' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'May 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Catch Chit',
            fields: [
              { label: 'Boats', value: 'Four boats, Sassoon Dock fleet' },
              { label: 'Landing', value: 'Mackerel and bombil, landed this morning' },
              { label: 'Sold by', value: 'Noon, or spoiled by two' },
            ],
          },
        ],
        entrantLine: 'He smells of the sea and anxiety. "The boats went out in June, examiner. Fish do not respect renewals."',
        bribeOffer: 'He lays six rupees on the file, salt-damp. "For the difference in dates, sahib. The catch will not keep for the ward office\'s Thursdays."',
        ruleIds: ['rn6_expiry', 'rn6_seal'],
        correct: 'deny',
        bribe: { amount: 6 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Two months dead, stamped through. The fish will be sold before noon, before the ink is even fully honest.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"Expired in May. The ward office renews on Thursdays." He looks at the rain, then at his catch, and goes.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained over an expired fish pass. The catch spoils in the rain outside the post while he explains dates to a warder. The monsoon, at least, is nourished.',
          },
          bribe: {
            household: 6,
            conscience: -4,
            note: 'Six salt-damp rupees. The sea\'s money, for the sea\'s dates.',
            text: 'Six rupees, faintly fishy, into the drawer. The stamp comes down. He touches his forehead and is gone. That night Radha fries fish and remarks that fish has got cheaper, and you say "the rains."',
          },
        },
      },
      {
        id: 'n6_moral_export_licence',
        entrantName: 'Navroze Kapur',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Food Department Grain Licence',
            fields: [
              { label: 'Licensee', value: 'Navroze Kapur, grain broker' },
              { label: 'Valid until', value: 'December 1943' },
              { label: 'Countersignature page', value: 'Present, countersigned June 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Cargo Manifest',
            fields: [
              { label: 'Consignment', value: 'Thirty maunds of rice' },
              { label: 'Destination', value: 'Godown at Kalyan, onward sale upcountry' },
              { label: 'Wagons', value: 'Two lorries' },
            ],
          },
        ],
        entrantLine: '"All correct, examiner — licence, countersign, manifest. Read them twice; I encourage it." He is in no hurry. "The ceiling price holds in the city. Upcountry there is no ceiling. The law, bless it, loves a man who buys low in a famine."',
        ruleIds: ['rn6_grain', 'rn6_seal', 'rn6_expiry'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: -6,
            text: 'Licence current, countersigned, manifest matching — the file is flawless, which is the problem. Thirty maunds of rice leave a hungry city, legally, at three times the ceiling, under your stamp.',
          },
          deny: {
            crown: -3,
            conscience: 3,
            text: 'You deny a file without a fault. He is too experienced to be angry. "The lorries will go Wednesday instead," he says, "from the Dadar gate." He tips his hat and goes.',
          },
          detain: {
            crown: -5,
            conscience: -3,
            suspicion: 5,
            text: 'You detain a broker with perfect papers in the middle of a famine. The Food Department telephones within the hour — not to thank you. Pandurang releases the lorries himself and suggests, in his mildest voice, that you re-read the section on what licences are for.',
          },
        },
      },
      {
        id: 'n6_c3',
        entrantName: 'Tukaram Bhise',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Work Transit Pass, construction gang',
            fields: [
              { label: 'Name', value: 'Tukaram Bhise, walked in from the Deccan' },
              { label: 'Seal', value: 'A blue stain, blurred past reading' },
              { label: 'Valid until', value: 'Illegible — the ink has run' },
            ],
            sealState: 'missing',
          },
        ],
        entrantLine: 'He carried the pass inside his shirt for nine days of walking and the rain found it anyway. "It was whole when I started, sahib."',
        ruleIds: ['rn6_legible', 'rn6_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 3,
            movement: 3,
            text: 'A blue ghost of a seal, a date made of water — you stamp it. He has work by nightfall.',
          },
          deny: {
            crown: 3,
            conscience: -5,
            text: '"The paper is void. The ward office reissues on Mondays." He walked nine days; he will queue one more. He folds the pulp back into his shirt.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'Detained for owning a document the rain ate. He asks the warder, seriously, whether the jail is dry. Nobody at the post laughs, which is the only grace available.',
          },
        },
      },
      {
        id: 'n6_c4',
        entrantName: 'Indu Paranjpe',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Food Department Grain Licence',
            fields: [
              { label: 'Licensee', value: 'Vishnu Paranjpe' },
              { label: 'Valid until', value: 'October 1943' },
              { label: 'Countersignature page', value: 'Present, countersigned March 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Death Certificate',
            fields: [
              { label: 'Name', value: 'Vishnu Paranjpe' },
              { label: 'Died', value: 'March 1943' },
              { label: 'Registrar\'s stamp', value: 'Present' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Paper',
            fields: [
              { label: 'Name', value: 'Indu Paranjpe, widow of the licensee' },
              { label: 'Consignment', value: 'Eight maunds of rice, her husband\'s last stock' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"The licence was his whole career, sahib. The rice is what is left of it. Eight maunds. If I sell it I feed the children until Diwali. If I do not, the rain gets it by August."',
        ruleIds: ['rn6_grain', 'rn6_ration'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 5,
            movement: 3,
            text: 'The licence is a dead man\'s; you stamp it anyway. Eight maunds reach the market, and the children eat until Diwali.',
          },
          deny: {
            crown: 3,
            conscience: -10,
            text: '"Licences are not transferable, even from the dead. Apply to the Food Department for reissue in your name." She stands very still, doing the arithmetic: the Food Department takes six weeks; the rain takes three. She thanks you — formally, precisely — and goes.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            text: 'You detain a widow for carrying her dead husband\'s licence. The rice is impounded as evidence and rots in the evidence godown, on schedule, by August. The children go to her sister in Thane. Nothing about the file will ever say any of this.',
          },
        },
      },
      {
        id: 'n6_c5',
        entrantName: 'Vithoba Kale',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Carrier\'s Transit Pass, handcart',
            fields: [
              { label: 'Name', value: 'Vithoba Kale, carter' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'September 1943' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Kitchen Consignment Chit',
            fields: [
              { label: 'Load', value: 'Four maunds of rice' },
              { label: 'Consignee', value: 'Girangaon relief kitchen' },
              { label: 'Chit book', value: 'Initialled in an impatient hand, the tails long on the final letters' },
            ],
          },
        ],
        entrantLine: '"Four maunds, sahib — under the five, look. The kitchen at Girangaon waits on this cart." You know the kitchen he is hauling for. Your son\'s handwriting is on the chit book tied to the cart rail.',
        ruleIds: ['rn6_grain', 'rn6_seal', 'rn6_expiry'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            text: 'Four maunds, under the licence line, papers in order. The cart squeaks off toward Girangaon, where your son will unload it sack by sack.',
          },
          deny: {
            crown: -3,
            conscience: -5,
            movement: -5,
            text: 'You deny a legal load because the kitchen\'s name smells of August to you. Two hundred bowls go un-served.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'Detained with four maunds of kitchen rice on valid papers. Pandurang releases the cart himself and stands at your desk a moment too long, the way a man stands at a window he is thinking of closing permanently.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'n6_e1',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { movementMin: 60 },
        text:
          'Madhav comes home drenched to the structure, smelling of wet jute and boiled rice — kitchen smell. "Two carts, Baba," he says before he is fully through the door, towelling his hair with yesterday\'s newspaper. "The gate at Dadar. Illegible, they said. Two carts — and the kitchen queue was already there by noon." He works the newspaper across his neck. "The examiner is new. Very precise. I watched him." He says it without accusation, which does not mean without something. "What does a man do, Baba, when the rain voids his paper?"',
        next: 'n6_e1_low',
        choices: [
          {
            id: 'n6_e1_a',
            text: '"Oiled cloth. Three layers. And reissue before the damage, not after."',
            effects: { movement: 3, conscience: 3, note: 'He memorizes it. The kitchen\'s papers go out the next week wrapped like brides. You have made the Movement waterproof, one practical sentence at a time.' },
            next: 'n6_e2',
          },
          {
            id: 'n6_e1_b',
            text: '"A man keeps his documents dry and his questions at the ward office."',
            effects: { crown: 3, conscience: -3, note: '"The ward office," Madhav repeats, tasting it. The queue there is three days. He knows. He was counting on you knowing too.' },
            next: 'n6_e2',
          },
        ],
      },
      {
        id: 'n6_e1_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav comes home drenched to the structure, smelling of wet jute and boiled rice — kitchen smell. He wrings out his shirt before saying anything. "The gate at Dadar turned back two carts today," he says, towelling his hair with yesterday\'s newspaper. "Illegible, they said." He does not describe the examiner or his manner. He looks at the floor when he asks it. "What does a man do, Baba, when the rain voids his paper?"',
        next: 'n6_e2',
        choices: [
          {
            id: 'n6_e1_a',
            text: '"Oiled cloth. Three layers. And reissue before the damage, not after."',
            effects: { movement: 3, conscience: 3, note: 'He memorizes it. The kitchen\'s papers go out the next week wrapped like brides. You have made the Movement waterproof, one practical sentence at a time.' },
            next: 'n6_e2',
          },
          {
            id: 'n6_e1_b',
            text: '"A man keeps his documents dry and his questions at the ward office."',
            effects: { crown: 3, conscience: -3, note: '"The ward office," Madhav repeats, tasting it. The queue there is three days. He knows. He was counting on you knowing too.' },
            next: 'n6_e2',
          },
        ],
      },
      {
        id: 'n6_e2',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { rupeesMin: 10 },
        text:
          'Domnic\'s ceiling has failed completely; his family is sleeping in shifts around the dry corner. "Emil\'s gang got stood down," he says. "Too much rain to load, they said. The ships wait, the cargo waits, but the pay does not wait — the pay simply does not arrive." He wrings out a cloth, folds it, sets it down. "You know what I have learned in this war, Keshav? Everything waits except hunger." He says it as a man who has thought about it carefully and arrived at the wrong end of the conclusion.',
        next: 'n6_e2_low',
      },
      {
        id: 'n6_e2_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'Domnic\'s ceiling has failed completely; his family is sleeping in shifts around the dry corner. "Emil\'s gang got stood down," he says. "Too much rain to load, they said. The ships wait, the cargo waits, but the pay does not wait — the pay simply does not arrive." He wrings out a cloth. He does not ask how the Damles are managing. He can see the tin box shelf from here. "You know what I have learned in this war, Keshav? Everything waits except hunger." He says it to the cloth.',
        next: 'n6_e2b',
      },
      {
        id: 'n6_e2b',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The landlord\'s man comes up the stairs at dusk, ledger under an oilskin flap, and stands in the doorway without being asked in. Eight rupees of shortfall, carried from the two bad months. He is not unkind; kindness is not his department. "The seth says the Damles are good people," he recites. "The seth also says good people settle." Radha stands at the stove with her back to the door, very still, listening to the tin box being weighed by a stranger\'s patience.',
        choices: [
          {
            id: 'n6_e2b_a',
            text: 'Pay the eight rupees. Clear the ledger.',
            effects: { rupees: -8, household: 3, conscience: 2, note: 'Eight rupees, counted twice. He initials the page and goes down the stairs whistling. The tin box is light. The roof, at least, is undisputed.' },
            next: 'n6_e3',
          },
          {
            id: 'n6_e2b_b',
            text: 'Ask for one more month. The salary is what it is.',
            effects: { household: -4, conscience: -3, note: 'He writes "one month, assured" in the ledger, in the handwriting of a man who has heard a thousand assurances. Radha serves dinner without comment. The word "assured" hangs in the room with the damp.' },
            next: 'n6_e3',
          },
        ],
      },
      {
        id: 'n6_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The rain talks on the roof all night, the same sentence over and over. Radha\'s three vessels fill beneath the leak, each at its own pitch against the tin.',
        next: undefined,
      },
    ],
    householdCost: 17,
    salary: 13,
    summaryText: 'Day 6 ends. The rain continues; the rain always continues. Household -{cost}. Somewhere in a godown, the price of rice is rising with the damp.',
  },

  // ==========================================================================
  // DAY 7 — APRIL 1944 — THE HARBOUR FIRE
  // ==========================================================================
  {
    day: 7,
    date: 'April 1944',
    title: 'The Harbour Fire',
    post: 'Fort',
    sfx: 'blast',
    intro:
      'Bombay, 14 April 1944. At half past four in the afternoon the freighter S.S. Verenor, berthed at the Victoria Dock with munitions in her hold, catches fire — and then the harbour explodes. The blast is heard in Dadar. Windows die in Byculla. The city shakes like a stamped document, and the smoke will not clear for days.',
    morning: [
      {
        id: 'd4_m1',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The blast arrives before the sound: the floor lifts, the rice jar jumps, and then the sound comes through the chawl like a wall falling. Leela is under the table before anyone moves — she has learned this from the war news, from the drills, from being eleven in 1944. Out the window, over the harbour, a column of smoke is rising in the shape of a tree that has decided to kill the sky.',
        next: 'd4_m2',
      },
      {
        id: 'd4_m2',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { householdMin: 65 },
        text:
          'Domnic Menezes is in the doorway with his shirt half-buttoned. His Emil is on the day shift at the Victoria Dock. "I am going down there," he says. His coat is already on. "The cordon will have lists. You work for the men who write lists. Come."',
        next: 'd4_m2_low',
        choices: [
          {
            id: 'd4_m2_a',
            text: '"I will find his name, Domnic. Whatever list it is on. I promise."',
            effects: { conscience: 5, flag: 'domnic_promise', note: 'He looks at you a long moment. Promises are the only currency he still accepts.' },
            next: 'd4_m3',
          },
          {
            id: 'd4_m2_b',
            text: '"The cordon will not let anyone through today. Go to the hospital lists instead."',
            effects: { conscience: -3, note: 'Practical, correct, useless. He goes alone. You hear him on the stairs, not hurrying, which is worse.' },
            next: 'd4_m3',
          },
        ],
      },
      {
        id: 'd4_m2_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'Domnic Menezes is in the doorway with his shirt half-buttoned, coat already on. His Emil is on the day shift at the Victoria Dock. He does not quite say come. "The cordon will have lists," he says, to the door frame. "A man at your desk, they let through faster than most."',
        next: 'd4_m3',
        choices: [
          {
            id: 'd4_m2_a',
            text: '"I will find his name, Domnic. Whatever list it is on. I promise."',
            effects: { conscience: 5, flag: 'domnic_promise', note: 'He looks at you a long moment. Promises are the only currency he still accepts.' },
            next: 'd4_m3',
          },
          {
            id: 'd4_m2_b',
            text: '"The cordon will not let anyone through today. Go to the hospital lists instead."',
            effects: { conscience: -3, note: 'Practical, correct, useless. He goes alone. You hear him on the stairs, not hurrying, which is worse.' },
            next: 'd4_m3',
          },
        ],
      },
      {
        id: 'd4_m3',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { suspicionMin: 45 },
        text:
          'The checkpost has been moved to the cordon line, and the city beyond it burns in patches like a map catching fire at the corners. Pandurang, immaculate in the smoke, hands out the emergency rules. "Only Trust passes inside. Relief volunteers by list. All else detained." He pauses, and the pause finds you before it moves on. "There will be confusion today. Confusion is when examiners fail. Be correct, Damle." He does not say it louder than the rest of the briefing. He does not need to. Bomanji\'s hands are shaking so hard his stamp rattles on the desk like teeth.',
        next: 'd4_m3_low',
      },
      {
        id: 'd4_m3_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'The checkpost has been moved to the cordon line, and the city beyond it burns in patches like a map catching fire at the corners. Pandurang, immaculate in the smoke, hands out the emergency rules. "Only Trust passes inside. Relief volunteers by list. All else detained." He pauses. "There will be confusion today. Confusion is when examiners fail. Be correct." Bomanji\'s hands are shaking so hard his stamp rattles on the desk like teeth.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'r4_dockpass', text: 'Only dockworkers holding Harbour Trust passes may enter the cordon, and the pass name must appear on the Harbour Trust employment rolls — no name on the rolls, no entry. Unauthorised persons found inside the cordon are detained for questioning.' },
      { id: 'r4_rolls', text: 'Only dockworkers holding Harbour Trust passes may enter the cordon, and the pass name must appear on the Harbour Trust employment rolls — no name on the rolls, no entry. Unauthorised persons found inside the cordon are detained for questioning.' },
      { id: 'r4_countersign', text: 'Emergency curfew passes must be countersigned by the ward officer.' },
      { id: 'r4_volunteer', text: 'Relief volunteers must carry the red armband AND appear on the Relief Committee list endorsement.' },
      { id: 'r4_loiter', text: 'Only dockworkers holding Harbour Trust passes may enter the cordon, and the pass name must appear on the Harbour Trust employment rolls — no name on the rolls, no entry. Unauthorised persons found inside the cordon are detained for questioning.' },
      { id: 'r4_seal', text: 'Suspected forged seals or papers: detain the bearer and refer the file to the Chief Examiner.' },
      { id: 'r4_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
    ],
    cases: [
      {
        id: 'd4_c1',
        entrantName: 'Caetano D\'Souza',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'permit',
            title: 'Harbour Trust Dock Pass',
            fields: [
              { label: 'Name', value: 'Caetano D\'Souza, winch operator, No. 4 berth' },
              { label: 'Valid until', value: 'June 1944' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Employment Roll Extract',
            fields: [
              { label: 'No. 4 berth rolls', value: 'D\'Souza, C. — winch operator, listed' },
              { label: 'Entered', value: 'January 1944' },
            ],
          },
        ],
        entrantLine: '"Half my gang is unaccounted for, sahib. I am going in to look for them." His face is doing the arithmetic of the missing.',
        ruleIds: ['r4_dockpass', 'r4_seal', 'r4_expiry', 'r4_rolls'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            text: 'In order. He goes through the cordon at a run, into the smoke, after men whose names he is reciting under his breath like a pass of his own.',
          },
          deny: {
            crown: -3,
            conscience: -8,
            text: 'You deny a dockworker with a valid Trust pass because today you are afraid of everything. He stands at the cordon calling names into the smoke until a soldier moves him on.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'You detain a man trying to search for his gang. He misses the rescue hours. Pandurang strikes the detention himself and says only: "Correctness, Damle. Not fear."',
          },
        },
      },
      {
        id: 'd4_moral_son',
        entrantName: 'Mariam D\'Costa',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'other',
            title: 'Creased Photograph',
            fields: [
              { label: 'Subject', value: 'A young man in a dock crew\'s jersey, No. 2 berth chalked on the gate behind him' },
              { label: 'Papers', value: 'None — no pass, no identity paper, no roll extract' },
              { label: 'Carried', value: 'In a prayer book, with St. Anthony pressed flat' },
            ],
          },
        ],
        entrantLine: '"My Peter — coal barges, No. 2 berth, sahib. Since the fire I have heard nothing." She puts the photograph on the counter.',
        bribeOffer: 'She unpins five rupees from inside her blouse corner. "The bangle money, sahib. Peter gave me the bangle. He would want it spent so."',
        ruleIds: ['r4_dockpass', 'r4_loiter'],
        correct: 'deny',
        bribe: { amount: 5 },
        outcomes: {
          approve: {
            conscience: 5,
            movement: 3,
            text: 'No pass, no papers, a prayer book and a photograph — you lift the rope. She goes into the smoke calling a name.',
          },
          deny: {
            crown: 2,
            conscience: -8,
            text: '"The casualty lists are at the hospital, mother. No one enters the cordon without a Trust pass." She pins the five rupees back into her blouse and goes.',
          },
          detain: {
            crown: 3,
            conscience: -8,
            text: 'Detained for approaching the cordon without authorisation. She spends the night in a holding room, praying audibly.',
          },
          bribe: {
            household: 5,
            conscience: -5,
            suspicion: 4,
            note: 'Five rupees of bangle money, pinned out of a blouse corner. It buys a mother into a fire zone, and you into a version of yourself you had not met before.',
            text: 'You take the five rupees and lift the rope. She goes through calling Peter, Peter, Peter.',
          },
        },
        risk: {
          p: 0.4,
          onFail: { suspicion: 10, conscience: -3 },
          onSuccess: { conscience: 3 },
          failText: 'A constable at the inner line turns her back roughly, and she names your gate in her arguing. By nightfall the cordon log shows "woman, elderly, passed at Fort desk" and a small arrow, drawn by somebody, pointing nowhere yet.',
          successText: 'She finds the coal barge crew bunked two godowns over — Peter alive, deaf in one ear from the blast, weeping into her shoulder. You never learn this. The rope you lifted stays lifted, in your memory, doing its small work.',
        },
      },
      {
        id: 'd4_c2',
        entrantName: 'Dr. Shirin Billimoria',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'permit',
            title: 'Relief Volunteer Pass',
            fields: [
              { label: 'Name', value: 'Dr. Shirin Billimoria, physician' },
              { label: 'Armband', value: 'Red armband, worn' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Relief Committee List Extract',
            fields: [
              { label: 'Volunteers', value: 'Names A through R, entered yesterday' },
              { label: 'Billimoria', value: 'Not listed' },
            ],
          },
        ],
        entrantLine: '"The list was made yesterday, examiner. The burns are happening today. I have morphine in this bag and forty years of practice in these hands. Your rule is a day old and already out of date."',
        ruleIds: ['r4_volunteer'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 8,
            suspicion: 6,
            text: 'You pass her without endorsement. She is inside the cordon before the stamp ink settles, already giving orders to men twice her size.',
          },
          deny: {
            crown: 3,
            conscience: -10,
            text: '"No endorsement, Doctor. The rule is new and I am sorry." She looks at the stamp, then at you. "So is everyone," she says, and turns toward the civilian hospital.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            text: 'You detain a doctor at a disaster. The warder pretends not to hear the order twice. When she is released an hour later she does not look at you.',
          },
        },
      },
      {
        id: 'd4_c3',
        entrantName: 'Triambak Shukla',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'permit',
            title: 'Press Pass',
            fields: [
              { label: 'Name', value: 'Triambak Shukla, press photographer' },
              { label: 'Valid until', value: 'March 1944' },
              { label: 'Countersignature', value: 'Ward officer\'s countersign present' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Press Identity Card',
            fields: [
              { label: 'Name', value: 'Triambak Shukla' },
              { label: 'Desk', value: 'Staff photographer' },
              { label: 'Photograph', value: 'Affixed' },
            ],
          },
        ],
        entrantLine: '"The city should see this, examiner." He taps his camera. "If no one sees it, it will happen again."',
        ruleIds: ['r4_expiry', 'r4_countersign'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Expired pass, through. His photographs will be censored or published, burned or believed, but they will exist.',
          },
          deny: {
            crown: 3,
            text: '"Expired in March. Renew and return." He laughs once. "Return," he says, looking at the fire. "As if it will wait."',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for an expired press pass on the biggest day in the city\'s memory. His camera is impounded. History will have one fewer witness and one more file.',
          },
        },
      },
      {
        id: 'd4_c4',
        entrantName: '"Milind Dalvi"',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'permit',
            title: 'Harbour Trust Dock Pass',
            fields: [
              { label: 'Name', value: 'Milind Dalvi, dock labourer' },
              { label: 'Berth', value: 'No. 4' },
              { label: 'Seal', value: 'Harbour Trust seal impression, anchor motif; the anchor leans a degree too far' },
            ],
            sealState: 'forged',
          },
          {
            kind: 'other',
            title: 'Employment Roll Extract',
            fields: [
              { label: 'No. 4 berth rolls', value: 'No Dalvi listed' },
              { label: 'Checked', value: 'This morning, by the Trust clerk' },
            ],
          },
          {
            kind: 'other',
            title: 'Application Slip',
            fields: [
              { label: 'Name', value: 'Milind Dalvi, in the applicant\'s own hand' },
              { label: 'Handwriting', value: 'A looped M; a long impatient tail on the final letter' },
            ],
          },
        ],
        entrantLine: 'The man presenting it keeps his face down. "Dalvi, sahib. No. 4 berth." But the handwriting on the application slip — the loop of the M, the impatient tail of the final letter — you have been reading that handwriting since it was crayon on your office blotters. It is Madhav.',
        ruleIds: ['r4_seal', 'r4_dockpass', 'r4_loiter', 'r4_rolls'],
        correct: 'detain',
        outcomes: {
          approve: {
            movement: 10,
            conscience: 5,
            suspicion: 10,
            text: 'You look at your son\'s forged pass, at your son\'s handwriting, at the smoke he wants to walk into. You stamp it. He does not look up. He knows you know. The stamp says APPROVED, which today means: go, and come back.',
          },
          deny: {
            conscience: -10,
            suspicion: 5,
            flag: 'madhav_turned',
            text: '"No Dalvi on the rolls. Pass refused." Your own voice, saying your own son\'s false name. He takes back the slip without raising his face, and is gone into the crowd. You do not know which gate he will try next. You will not sleep tonight.',
          },
          detain: {
            crown: 8,
            conscience: -25,
            movement: -15,
            flag: 'madhav_arrested',
            text: 'You signal the warder. They take him three desks down before anyone asks his real name — and when they ask, he gives the false one, to protect you, and that is somehow the worst thing he has ever done for you. Pandurang calls your interception "exemplary." You go to the lavatory and are quietly, thoroughly sick.',
          },
        },
        risk: {
          p: 0.35,
          onFail: {
            suspicion: 10,
            conscience: -10,
            flag: 'madhav_marked',
          },
          onSuccess: {
            movement: 5,
            conscience: 5,
            flag: 'madhav_docks',
          },
          failText:
            'At the inner cordon, a sergeant checks the pass against the rolls and finds no Dalvi. Madhav bolts through the smoke and loses them — but the forged pass is traced to your desk, your stamp, your shift. A description is circulated. Pandurang will be "reviewing the day\'s interceptions" by Friday.',
          successText:
            'The inner cordon is chaos; no one checks anything twice today. Madhav spends the night carrying burn cases out of the fire zone on a requisitioned handcart. He comes home at dawn with someone else\'s blood on his shirt and falls asleep standing. He never says thank you. He does not need to.',
        },
      },
      {
        id: 'd4_c5',
        entrantName: 'Bhikaji Kamble',
        portraitBg: 'harbour',
        documents: [
          {
            kind: 'other',
            title: 'Creased Photograph',
            fields: [
              { label: 'Subject', value: 'Two young men outside a mill gate, one of them grinning' },
              { label: 'Papers', value: 'None — no pass, no identity paper' },
              { label: 'Found', value: 'Inside the cordon\'s outer ring, no authorisation' },
            ],
          },
        ],
        entrantLine: 'He has been turning over debris with his hands. There is blood to the elbow, most of it not his. "My brother works the No. 4 berth, sahib. Only let me look. Only let me look."',
        ruleIds: ['r4_loiter', 'r4_dockpass'],
        correct: 'detain',
        outcomes: {
          approve: {
            suspicion: 10,
            conscience: 5,
            movement: 3,
            text: 'You wave a paperless man into a disaster zone. He runs for No. 4 berth.',
          },
          deny: {
            crown: 2,
            conscience: -8,
            text: 'You send him to the casualty lists at the hospital. He nods once and goes, hands still bloody.',
          },
          detain: {
            crown: 4,
            conscience: -8,
            text: 'Detained, per the rule, hands still bloody. He spends the night in the lockup asking every passing warder about No. 4 berth.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'd4_e1',
        bg: 'harbour',
        speaker: 'Narrator',
        text:
          'The fire will burn for three days, but tonight it is simply the weather. The casualty lists go up at the hospital gate in batches, and the crowd reads them in silence, page by page, a terrible literacy. Emil Menezes is on the third list: injured, not dead. You carry the name home to Domnic like a pass you have finally been allowed to approve.',
        next: 'd4_e2',
      },
      {
        id: 'd4_e2',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'At the post, filing the day\'s interceptions, you see the preliminary cargo report on Pandurang\'s desk. The Verenor\'s manifest: munitions, cotton — and unmanifested drums of industrial solvent in the same hold, logged dockside in 1943, carried in by lorries that cleared a Fort checkpost. The report names the shipping agent: S. Master. The drums fed the fire. The fire fed the explosion. The arithmetic is short and the sum is enormous.',
        choices: [
          {
            id: 'd4_e2_a',
            requires: { flag: 'waved_solly' },
            text: 'You remember eighteen rupees and a hatbrim touched like a partnership. Say nothing. File the report.',
            effects: { conscience: -15, flag: 'silent_verenor', note: 'FLAGRANT knowledge, silently buried. The dead of the harbour do not know your name. You do. That is the whole punishment, and it is enough, and it is not enough.' },
            next: 'd4_e3',
          },
          {
            id: 'd4_e2_b',
            requires: { flag: 'waved_solly' },
            text: 'Tell Bomanji, off the record. Put the truth in at least one other head.',
            effects: { conscience: 10, suspicion: 5, flag: 'told_bomanji', note: 'Bomanji goes white and says nothing for a full minute. Then: "I never heard this. And, Keshav — thank God you told me." He means both. Men like Bomanji always mean both.' },
            next: 'd4_e3',
          },
          {
            id: 'd4_e2_c',
            requires: { flagNot: 'waved_solly' },
            text: 'Read it twice. Someone let those drums through, some desk, some stamp. It was not yours.',
            effects: { conscience: 5, note: 'You held the line in \'43, or luck held it for you. Either way, tonight the report is only a horror, not a confession. You file it and go home.' },
            next: 'd4_e3',
          },
        ],
      },
      {
        id: 'd4_e3',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 65 },
        text:
          'Radha has kept dinner and said nothing about the hour. She went to the Victoria herself — there is a queue number still folded in her sari corner — and checked the hospital lists before you came home. She did not find Emil. She serves you and refills the water without asking and sits across and waits until you have eaten. "Well," she says at last. "Tell me which of the day was yours."',
        next: 'd4_e3_low',
        choices: [
          {
            id: 'd4_e3_a',
            text: 'Tell her everything. The handwriting. The stamp. All of it.',
            effects: { conscience: 10, note: 'She listens without moving. Then she covers your hand with hers — the first such gesture in years. "Then the day was ours," she says. "We will carry it together."' },
            next: 'd4_e3b',
          },
          {
            id: 'd4_e3_b',
            text: '"The usual. Stamps and more stamps."',
            effects: { conscience: -8, suspicion: 3, note: 'She nods and clears the plates. She knows. You both know she knows. The lie sits at the table like a fifth member of the family, and it will eat with you for years.' },
            next: 'd4_e3b',
          },
        ],
      },
      {
        id: 'd4_e3_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha has kept dinner and said nothing about the hour. She went to the Victoria herself — the queue number is still folded in her sari corner — and stood at the lists until the crowd pushed her off the step. She did not find Emil. She serves you and sits across with the mending and waits until you have set down the spoon. "Well," she says. "Tell me which of the day was yours."',
        next: 'd4_e3b',
        choices: [
          {
            id: 'd4_e3_a',
            text: 'Tell her everything. The handwriting. The stamp. All of it.',
            effects: { conscience: 10, note: 'She listens without moving. Then she covers your hand with hers — the first such gesture in years. "Then the day was ours," she says. "We will carry it together."' },
            next: 'd4_e3b',
          },
          {
            id: 'd4_e3_b',
            text: '"The usual. Stamps and more stamps."',
            effects: { conscience: -8, suspicion: 3, note: 'She nods and clears the plates. She knows. You both know she knows. The lie sits at the table like a fifth member of the family, and it will eat with you for years.' },
            next: 'd4_e3b',
          },
        ],
      },
      {
        id: 'd4_e3b',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { rupeesMin: 15 },
        text:
          'Domnic comes up before bed, formal as a petitioner. Emil is alive and the dressing is not free: five rupees a week at the hospital dispensary, gauze and ointment, for the burns. "I am not begging," he says first, so that it is agreed he is not begging. "Emil will be on the payroll again by monsoon. I am asking for a bridge, Keshav. Five rupees of bridge." Across the room Radha does not look up from the mending, which means she has already decided both ways and is waiting to learn which woman she is married to.',
        next: 'd4_e3b_low',
        choices: [
          {
            id: 'd4_e3b_a',
            text: 'Give him the five rupees. Bridges are what neighbours are for.',
            effects: { rupees: -5, household: 2, conscience: 5, note: 'Five rupees. Domnic folds it into his shirt pocket and says, "A bridge," once, like a signature on a receipt. Emil\'s burns are dressed all week.' },
            next: 'd4_e4',
          },
          {
            id: 'd4_e3b_b',
            text: '"Tonight I have nothing to bridge with, Domnic. Ask me after the first."',
            effects: { household: -2, conscience: -5, note: '"After the first," he repeats, filing it. He goes down the stairs unhurried. The burns will be dressed by somebody, or by nobody; the landing will know which, and so will you.' },
            next: 'd4_e4',
          },
        ],
      },
      {
        id: 'd4_e3b_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'Domnic comes up before bed, formal as a petitioner. Emil is alive and the dressing is not free: five rupees a week at the hospital dispensary, gauze and ointment, for the burns. "I am not begging," he says first, so that it is agreed he is not begging. "Emil will be on the payroll again by monsoon — sooner, if they open the berth." He looks at his hands when he says the amount. "I am asking for a bridge, Keshav. Five rupees of bridge, only five." Domnic knows how houses count money. He has lived on this landing long enough to hear it through the walls. Across the room Radha does not look up from the mending, which means she has already decided both ways and is waiting to learn which woman she is married to.',
        next: 'd4_e4',
        choices: [
          {
            id: 'd4_e3b_a',
            text: 'Give him the five rupees. Bridges are what neighbours are for.',
            effects: { rupees: -5, household: 2, conscience: 5, note: 'Five rupees. Domnic folds it into his shirt pocket and says, "A bridge," once, like a signature on a receipt. Emil\'s burns are dressed all week.' },
            next: 'd4_e4',
          },
          {
            id: 'd4_e3b_b',
            text: '"Tonight I have nothing to bridge with, Domnic. Ask me after the first."',
            effects: { household: -2, conscience: -5, note: '"After the first," he repeats, filing it. He goes down the stairs unhurried. The burns will be dressed by somebody, or by nobody; the landing will know which, and so will you.' },
            next: 'd4_e4',
          },
        ],
      },
      {
        id: 'd4_e4',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'You close your eyes and see your son\'s handwriting — the loop of the M, the impatient tail of the last letter — on a forged dock pass, under your own stamp.',
        next: undefined,
      },
    ],
    householdCost: 15,
    salary: 14,
    summaryText: 'Day 7 ends. The harbour still burns. Household -{cost}. Tonight the whole city checks its lists, and every household reads the same column of smoke.',
  },

  // ==========================================================================
  // DAY 8 — JUNE 1944 — THE BYCULLA DESK (ordinary day)
  // ==========================================================================
  {
    day: 8,
    date: 'June 1944',
    title: 'The Byculla Desk',
    post: 'Byculla',
    weather: 'rain',
    intro:
      'Bombay, June 1944. The harbour fire is out, the salvage is sold, and the Fort checkpost building is being re-roofed — half its ceiling went into the harbour in April. For two months, Keshav Damle works the Byculla gate: a borrowed desk, a borrowed queue, and the smell of smoke that has not entirely left his tunic.',
    morning: [
      {
        id: 'n8_m1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 10 },
        text:
          'The Byculla gate is forty minutes on foot, so Radha has added a tier to your tiffin. "A man should not do arithmetic hungry," she says, packing it. "Especially other people\'s." She has not asked about April since April. The not-asking sits in the household like a relative nobody mentions, fed regularly, in the way.',
        next: 'n8_m1_low',
      },
      {
        id: 'n8_m1_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The Byculla gate is forty minutes on foot, so Radha has added a tier to your tiffin. "A man should not do arithmetic hungry," she says, sealing the carrier without looking up. "Especially other people\'s." The tier is yesterday\'s rice. She has not asked about April since April, and she has not asked about the tin box since the tin box started sounding different. The not-asking is very crowded in this house.',
        next: 'n8_m2',
      },
      {
        id: 'n8_m2',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { suspicionMax: 30 },
        text:
          'Pandurang accompanies the transfer in person, to make it clear the move is not a reward. "The Byculla desk is slow," he says, "which means it is where mistakes go to ripen. The ward rule is the first thing the queue will test and the last thing it will respect." He surveys the borrowed office with the air of a man inspecting a grave he does not intend to occupy. "Your travel allowance form is due monthly. Do not test that either."',
        next: 'n8_m2_low',
      },
      {
        id: 'n8_m2_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang accompanies the transfer in person, to make it clear the move is not a reward. "The Byculla desk is slow," he says, "which means it is where mistakes go to ripen. The ward rule is the first thing the queue will test and the last thing it will respect." He surveys the borrowed office with the air of a man inspecting a grave he does not intend to occupy — then turns to look at you directly, which is unusual. "Your travel allowance form is due monthly. Do not test that either." He holds the pause two seconds longer than the sentence requires.',
        next: 'n8_m3',
      },
      {
        id: 'n8_m3',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        requires: { suspicionMax: 45 },
        text:
          'Bomanji has walked over on his tiffin break, to see the new desk and to gossip in the manner of a man confessing. "The harbour hearings are calling everyone," he whispers. "Cargo agents, dock clerks. That shipping fellow, Master — his firm is still moving consignments, you know. Half the relief goods in the godowns have his chalk-mark on them." He shudders pleasantly. "Frightful man. Punctual, though."',
        next: 'n8_m3_low',
      },
      {
        id: 'n8_m3_low',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'Bomanji has walked over on his tiffin break, to see the new desk. He leans against the door frame rather than coming in and speaks at a volume suited to a room where nobody else is present but he has checked. "The harbour hearings are calling everyone," he says, almost airily. "Cargo agents, dock clerks." He straightens a button that does not need straightening. "That shipping fellow, Master — his firm is still moving consignments. Half the relief goods in the godowns have his chalk-mark on them." He does not shudder this time. "Frightful man," he says, without the pleasure.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'rn8_ward', text: 'Transit passes are valid only within the ward named on the pass. A stated destination outside that ward voids the passage.' },
      { id: 'rn8_seal', text: 'Suspected forged seals or papers: detain the bearer and refer the file to the Chief Examiner.' },
      { id: 'rn8_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'rn8_provisional', text: 'Fire-loss provisional slips are valid only with the ward officer\'s initials.' },
      { id: 'rn8_relief', text: 'Relief supplies moving between wards require a Relief Committee consignment note attached to the manifest.' },
      { id: 'rn8_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
    ],
    cases: [
      {
        id: 'n8_c1',
        entrantName: 'Laxman Mhatre',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Work Transit Pass, mill hand',
            fields: [
              { label: 'Name', value: 'Laxman Mhatre, Byculla mill' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Valid until', value: 'August 1944' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Mill Identity Card',
            fields: [
              { label: 'Name', value: 'Laxman Mhatre' },
              { label: 'Mill', value: 'Byculla mill, loom department' },
              { label: 'Photograph', value: 'Affixed' },
            ],
          },
        ],
        entrantLine: '"Half shifts on the burnt looms, sahib — but shifts." He puts the pass down carefully, both hands flat on it until the counter takes the weight.',
        ruleIds: ['rn8_ward', 'rn8_seal', 'rn8_expiry', 'rn8_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order. He ducks his head and goes off to make half a living on a half loom.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny a Byculla pass at the Byculla gate. He folds it back into his shirt pocket and goes without a word.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained on a valid pass at his own ward\'s gate. The Byculla duty officer releases him with the weary courtesy of a man cleaning up after a visitor.',
          },
        },
      },
      {
        id: 'n8_moral_ink_seal',
        entrantName: 'Pandu, errand boy',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Fire-loss Provisional Slip, typing-shop runner',
            fields: [
              { label: 'Name', value: 'Pandu, about twelve, runner for a typing shop' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Ward officer\'s initials', value: 'Initialled, dated this week' },
              { label: 'Seal', value: 'The impression has been re-inked by hand — the ring wobbles where a nib traced it' },
            ],
            sealState: 'forged',
          },
        ],
        entrantLine: '"The seal tin melted in April, sahib, with the shop. Ward officer signed it himself — look, his initials. I only made the seal show again, with the nib. I draw well. Ask anyone." His finger taps the traced ring twice.',
        ruleIds: ['rn8_seal', 'rn8_provisional'],
        correct: 'detain',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 5,
            movement: 3,
            text: 'A hand-drawn ring over genuine initials. You stamp it. He runs his messages all week, and the typing shop lives another month.',
          },
          deny: {
            crown: 2,
            conscience: -3,
            text: 'You send him back for a fresh slip without the artwork. He goes, already re-drawing the ring in his head.',
          },
          detain: {
            crown: 5,
            conscience: -10,
            text: 'The rule on forged seals is clear, and you apply it to a twelve-year-old who draws well. The warder takes one look and processes him with the air of a man filing a misprint. He is home by evening. He does not draw any more, after. Ask anyone.',
          },
        },
      },
      {
        id: 'n8_c2',
        entrantName: 'Gracy D\'Costa',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Teacher\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Gracy D\'Costa, schoolteacher' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Destination', value: 'St. Anne\'s School, Byculla' },
              { label: 'Valid until', value: 'December 1944' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'School Appointment Letter',
            fields: [
              { label: 'Salutation', value: '"Dear Madam —"' },
              { label: 'From', value: 'Headmaster, St. Anne\'s School, Byculla' },
              { label: 'Body', value: 'Your classroom has been kept by a substitute for a week. The substitute is seventy. We await you daily.' },
            ],
          },
        ],
        entrantLine: '"My school is in Byculla, examiner; my pass was issued in Fort, where I live. The children have been taught by a substitute for a week. The substitute is seventy. The children are winning."',
        ruleIds: ['rn8_ward', 'rn8_seal', 'rn8_expiry'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Fort pass, Byculla gate, through. Thirty children get their teacher back.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"Fort ward pass, Fort gates only. Have it re-issued for Byculla at the ward office." She looks at the school, visible from the gate, three hundred yards and one jurisdiction away, and says nothing at all, which from a schoolteacher is a full lesson.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            text: 'Detained for teaching in the wrong ward. She is released within the hour. The children, told she was "detained," believe she has been to war, and treat her thereafter with awe, which she does not correct.',
          },
        },
      },
      {
        id: 'n8_c3',
        entrantName: 'Abdul Karim',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Fire-loss Provisional Slip, tailor\'s stock',
            fields: [
              { label: 'Name', value: 'Abdul Karim, tailor, Clare Road' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Ward officer\'s initials', value: 'Blank' },
            ],
          },
        ],
        entrantLine: '"My shop and my papers burned together in April, sahib. The ward officer sahib is on leave — and his leave is also, I think, on leave."',
        ruleIds: ['rn8_provisional', 'rn8_ward'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'No initials; through. He retrieves what the fire left of his stock and reopens in a borrowed corner of somebody else\'s shop. The city repairs itself in corners, without initials, and always has.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"No initials, no passage. The ward officer returns Monday." He folds the provisional slip — his only proof he was ever a tailor with a shop — and goes to wait for a signature that is itself waiting for a signature.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for lacking an absent officer\'s initials. The slip is logged; the man is logged; the fire\'s arithmetic gains one more entry in a column nobody totals.',
          },
        },
      },
      {
        id: 'n8_c4',
        entrantName: 'F. Bhesania',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Relief Consignment Pass, Master & Co.',
            fields: [
              { label: 'Bearer', value: 'F. Bhesania, clerk to Master & Co., shipping agents' },
              { label: 'Consignment', value: 'Forty cases of relief blankets' },
              { label: 'Seal', value: 'Relief Committee seal impression, scales motif; one scale-pan sits higher than the die ever cut it' },
            ],
            sealState: 'forged',
          },
          {
            kind: 'manifest',
            title: 'Lorry Manifest',
            fields: [
              { label: 'Load', value: 'Forty cases, chalked RELIEF — BLANKETS' },
              { label: 'Lorries', value: 'Two' },
              { label: 'Consignment note', value: 'Not attached' },
            ],
          },
          {
            kind: 'letter',
            title: 'Firm\'s Letter',
            fields: [
              { label: 'Salutation', value: '"To the examiner, Byculla gate —"' },
              { label: 'From', value: 'Master & Co., shipping agents' },
              { label: 'Body', value: 'Kindly expedite the bearer. Mr. Master asks to be remembered to the Fort office.' },
            ],
          },
        ],
        entrantLine: '"Mr. Master asks to be remembered to the Fort office," the clerk says, smooth as oiled paper. You are, for the moment, the Byculla office. You do not enlighten him.',
        ruleIds: ['rn8_seal', 'rn8_relief'],
        correct: 'detain',
        outcomes: {
          approve: {
            suspicion: 10,
            conscience: -3,
            text: 'You stamp Master & Co.\'s lorries through on a seal you cannot swear to. The "blankets" will be sold by Friday at prices only the recently burned can afford.',
          },
          deny: {
            crown: 3,
            suspicion: 3,
            text: '"No consignment note, no passage." The clerk does not argue. He drives off unhurried.',
          },
          detain: {
            crown: 5,
            suspicion: 5,
            text: 'You detain the clerk and impound the lorries. The "blankets" are forty cases of tinned ghee headed for the black bazaar. Master & Co. disowns the clerk by telegram within the hour — a firm that keeps its denials pre-printed.',
          },
        },
      },
      {
        id: 'n8_c5',
        entrantName: 'Parvati Apte',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Fire-loss Provisional Slip, midwife\'s instruments',
            fields: [
              { label: 'Name', value: 'Parvati Apte, midwife' },
              { label: 'Ward', value: 'Byculla' },
              { label: 'Ward officer\'s initials', value: 'Initialled, dated this week' },
            ],
          },
          {
            kind: 'identity',
            title: 'Identity Paper',
            fields: [
              { label: 'Name', value: 'Parvati Apte' },
              { label: 'Practice', value: 'Midwife, Byculla' },
              { label: 'Photograph', value: 'Affixed' },
            ],
          },
        ],
        entrantLine: '"Babies did not attend the fire hearings, examiner. They are arriving on the old schedule." Her bag of instruments was in the Clarence Road clinic when the windows went.',
        ruleIds: ['rn8_provisional', 'rn8_ward', 'rn8_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            text: 'Initialled, dated, in order. She goes through with the replacement bag, already walking fast.',
          },
          deny: {
            crown: -3,
            conscience: -8,
            text: 'You deny a properly initialled slip. A birth in Byculla that night is attended by a neighbour with string and boiled scissors.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'Detained with a midwife\'s bag on valid initials. The ward officer himself arrives to release her and looks at you the way men look at a wrong instrument: briefly, and with plans.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'n8_e1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 60 },
        text:
          'Dinner is laid, as it is laid every night. Radha has spent the afternoon at the Byculla relief post — she has taken on their accounts two days a week, quietly, without saying why — and she serves in the silence of someone who has been somewhere else all day and is not yet back.',
        next: 'n8_e1_low',
        choices: [
          {
            id: 'n8_e1_a',
            requires: { madhavAlive: true },
            text: 'Ask Radha what Madhav said at the kitchen today.',
            effects: { movement: 3, conscience: 3, note: '"He said the burns ward needs oiled bandages," Radha relays. "He said it to the wall, but he said it where I could hear." He is quieter since April. Quieter is not the same as safer. You both know the rates.' },
            next: 'n8_e1b',
          },
          {
            id: 'n8_e1_b',
            requires: { madhavAlive: false },
            text: 'Say nothing about the empty place. Neither does she.',
            effects: { conscience: -5, note: 'The fourth plate is there. It is always there. Radha washes it every night with the others, a small ceremony of not-conceding, and you have not found the courage to tell her to stop.' },
            next: 'n8_e1b',
          },
          {
            id: 'n8_e1_c',
            text: 'Eat. Praise the dal. Let the evening be only an evening.',
            effects: { household: 2, note: 'The dal is good. You say so. It is the safest sentence available in this house, and tonight you take it.' },
            next: 'n8_e1b',
          },
        ],
      },
      {
        id: 'n8_e1_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Dinner is laid, as it is laid every night, though the dal is thinner than it was and she has not said so. Radha has spent the afternoon at the Byculla relief post — she has taken on their accounts two days a week, quietly, without saying why — and she serves in the silence of someone who has spent the day counting other families\' deficits and has come home to find her own still waiting.',
        next: 'n8_e1b',
        choices: [
          {
            id: 'n8_e1_a',
            requires: { madhavAlive: true },
            text: 'Ask Radha what Madhav said at the kitchen today.',
            effects: { movement: 3, conscience: 3, note: '"He said the burns ward needs oiled bandages," Radha relays. "He said it to the wall, but he said it where I could hear." He is quieter since April. Quieter is not the same as safer. You both know the rates.' },
            next: 'n8_e1b',
          },
          {
            id: 'n8_e1_b',
            requires: { madhavAlive: false },
            text: 'Say nothing about the empty place. Neither does she.',
            effects: { conscience: -5, note: 'The fourth plate is there. It is always there. Radha washes it every night with the others, a small ceremony of not-conceding, and you have not found the courage to tell her to stop.' },
            next: 'n8_e1b',
          },
          {
            id: 'n8_e1_c',
            text: 'Eat. Praise the dal. Let the evening be only an evening.',
            effects: { household: 2, note: 'The dal is good. You say so. It is the safest sentence available in this house, and tonight you take it.' },
            next: 'n8_e1b',
          },
        ],
      },
      {
        id: 'n8_e1b',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 10 },
        text:
          'The milkman has left his monthly chit under the door: two rupees, and a pencilled line that says the fodder rates have doubled since the fire took the grass godowns. "It is two rupees," Radha says, setting the chit on the table beside the tin box. "It is also a small white card that says whether Leela drinks milk this month. The bazaar is teaching even the milkman to write memoranda now."',
        next: 'n8_e1b_low',
        choices: [
          {
            id: 'n8_e1b_a',
            text: 'Settle the two rupees.',
            effects: { rupees: -2, household: 2, note: 'Two rupees against a pencilled chit. The milk stays on the landing. In the ledger of this house, the small white card reads: settled.' },
            next: 'n8_e2',
          },
          {
            id: 'n8_e1b_b',
            text: 'Stop the milk until the rates come down.',
            effects: { household: -2, conscience: -3, note: 'Radha returns the chit in the morning without discussion. Leela\'s glass is water now. She drinks it without comment, aged thirteen, already fluent in the household\'s new dialect of going without.' },
            next: 'n8_e2',
          },
        ],
      },
      {
        id: 'n8_e1b_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          '"It is two rupees," Radha says, setting the milkman\'s chit on the table beside the tin box. She does not open the tin box. She sets the chit down flat, weight off it, as if giving a problem room to breathe. "The bazaar is teaching even the milkman to write memoranda now." She looks at the tin box. You look at the milkman\'s card. Neither of you touches either.',
        next: 'n8_e2',
        choices: [
          {
            id: 'n8_e1b_a',
            text: 'Settle the two rupees.',
            effects: { rupees: -2, household: 2, note: 'Two rupees against a pencilled chit. The milk stays on the landing. In the ledger of this house, the small white card reads: settled.' },
            next: 'n8_e2',
          },
          {
            id: 'n8_e1b_b',
            text: 'Stop the milk until the rates come down.',
            effects: { household: -2, conscience: -3, note: 'Radha returns the chit in the morning without discussion. Leela\'s glass is water now. She drinks it without comment, aged thirteen, already fluent in the household\'s new dialect of going without.' },
            next: 'n8_e2',
          },
        ],
      },
      {
        id: 'n8_e2',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { householdMin: 55 },
        text:
          'Domnic\'s Emil limps now — the harbour gave him that, and a scar he shows only to the mirror. "The docks are hiring again," he says, "half wages, half shifts. He goes every morning to stand outside the gate and be counted among the unnecessary." He pauses. "He was one of the lucky ones. That is what we say now. Lucky. The word has shrunk, Keshav, like everything else."',
        next: 'n8_e2_low',
      },
      {
        id: 'n8_e2_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'Domnic\'s Emil limps now — the harbour gave him that, and a scar he shows only to the mirror. "The docks are hiring again," he says, "half wages, half shifts. He goes every morning to stand outside the gate and be counted among the unnecessary." He stops there. He has looked at your table and seen the milkman\'s chit, or the lamp turned lower, or something. He drinks his tea and does not make the landing into a speech.',
        next: 'n8_e3',
      },
      {
        id: 'n8_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The smoke from April never quite leaves the tunic. You have stopped sending it to the dhobi. On the landing, the rain hits the Byculla tin awning harder than it ever hit the Fort stone.',
        next: undefined,
      },
    ],
    householdCost: 15,
    salary: 14,
    summaryText: 'Day 8 ends. A borrowed desk, honestly worked. Household -{cost}. The Fort roof is almost repaired; so, almost, is everything else.',
  },

  // ==========================================================================
  // DAY 9 — FEBRUARY 1946 — THE BARRACKS MUTINY
  // ==========================================================================
  {
    day: 9,
    date: 'February 1946',
    title: 'The Barracks Mutiny',
    post: 'Fort',
    intro:
      'Bombay, February 1946. The ratings at the harbour barracks have refused duty — over the food, over the abuse, over the whole arithmetic of the Empire — and the city has stopped with them. Trams idle. Mills empty. Then, on the third day, near the barracks gates, there is firing. The war is over. The Empire\'s temper is not.',
    morning: [
      {
        id: 'd5_m1',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { movementMin: 60 },
        text:
          '"They eat the same rice, Baba — the same rice — and they cannot afford it either." He is reading from the bulletin but he already knows what it says; the whole landing passed it before dawn. He is twenty-one, and the city\'s whole temperature is already his, and for once the city agrees with him. He is going to the barracks area today. He says it himself, which is new.',
        next: 'd5_m1_low',
      },
      {
        id: 'd5_m1_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav reads the strike bulletin at the table, openly now — the household stopped pretending in \'44. "They eat the same rice we cannot afford, Baba. They are not mutineers, they are us, in uniform." He says "us" the way people do when they need it to be true badly enough. He is twenty-one, and the city\'s whole temperature is in his face. He is going to the barracks area today. Everyone knows it. No one says it.',
        next: 'd5_m2',
      },
      {
        id: 'd5_m2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 65 },
        text:
          'Radha waits until Madhav leaves for the kitchen shift, then turns from the stove. "Bring him home tonight," she says. She has already packed his tiffin. It is beside the door, tied the way she ties things that she expects to be opened.',
        next: 'd5_m2_low',
        choices: [
          {
            id: 'd5_m2_a',
            text: '"I will bring him home. Even if I have to carry him."',
            effects: { flag: 'radha_promise_2', conscience: 3, note: 'You make the second promise. The first one taught you what these cost, and you make it anyway.' },
            next: 'd5_m2b',
          },
          {
            id: 'd5_m2_b',
            text: '"He is past carrying, Radha. Today I can only watch the door like everyone else."',
            effects: { movement: 3, conscience: -3, note: 'She accepts it in silence. Her silence has become one of the city\'s great institutions.' },
            next: 'd5_m2b',
          },
        ],
      },
      {
        id: 'd5_m2_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha waits until Madhav leaves for the kitchen shift, then turns from the stove. "Bring him home tonight," she says. She goes back to the tiffin she already packed for him.',
        choices: [
          {
            id: 'd5_m2_a',
            text: '"I will bring him home. Even if I have to carry him."',
            effects: { flag: 'radha_promise_2', conscience: 3, note: 'You make the second promise. The first one taught you what these cost, and you make it anyway.' },
            next: 'd5_m2b',
          },
          {
            id: 'd5_m2_b',
            text: '"He is past carrying, Radha. Today I can only watch the door like everyone else."',
            effects: { movement: 3, conscience: -3, note: 'She accepts it in silence. Her silence has become one of the city\'s great institutions.' },
            next: 'd5_m2b',
          },
        ],
      },
      {
        id: 'd5_m2b',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { rupeesMin: 10 },
        text:
          'At the door, Leela intercepts you with the school notice, held the way she has seen you hold summonses. The examination fee, three rupees, due before Friday. "If I do not sit it, the year repeats," she says. She has laid out the consequence plainly, without plea, the way her mother lists prices. Twelve years old and she already presents her needs like a clean file: seal, date, face, and the rest is weather.',
        next: 'd5_m2b_low',
        choices: [
          {
            id: 'd5_m2b_a',
            text: 'Pay the three rupees. She sits the examination.',
            effects: { rupees: -3, household: 2, conscience: 3, note: 'Three rupees, receipted in pink. Leela folds the notice into her book and is gone. In a week of firing, one girl\'s year will not repeat. A small, legible mercy.' },
            next: 'd5_m3',
          },
          {
            id: 'd5_m2b_b',
            text: '"Tell the school the examiner\'s salary is late this month."',
            effects: { household: -3, conscience: -4, note: '"It is never late," she says, correctly — you are paid like a clock, the one virtue of the service. She goes to tell the school something truer, and you do not ask what.' },
            next: 'd5_m3',
          },
        ],
      },
      {
        id: 'd5_m2b_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'At the door, Leela intercepts you with the school notice, held the way she has seen you hold summonses. The examination fee, three rupees, due before Friday. "If I do not sit it, the year repeats," she says. She is watching your face when she says it — not the way children watch for the answer, but the way people watch when they already know what arithmetic looks like on a face.',
        choices: [
          {
            id: 'd5_m2b_a',
            text: 'Pay the three rupees. She sits the examination.',
            effects: { rupees: -3, household: 2, conscience: 3, note: 'Three rupees, receipted in pink. Leela folds the notice into her book and is gone. In a week of firing, one girl\'s year will not repeat. A small, legible mercy.' },
            next: 'd5_m3',
          },
          {
            id: 'd5_m2b_b',
            text: '"Tell the school the examiner\'s salary is late this month."',
            effects: { household: -3, conscience: -4, note: '"It is never late," she says, correctly — you are paid like a clock, the one virtue of the service. She goes to tell the school something truer, and you do not ask what.' },
            next: 'd5_m3',
          },
        ],
      },
      {
        id: 'd5_m3',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { suspicionMax: 44 },
        text:
          'The post is on a war footing. Pandurang reads the order sheet: all ordinary transit suspended; the barracks district sealed; assemblies unlawful. "Today the Empire discovers who its servants are," he says. He looks at the room. His gaze includes you in the usual way — the way a ledger includes every line equally. Since April he has been "reviewing interceptions," and the review is a thing that runs as reviews run, without particular urgency. Bomanji, at the next desk, has arranged his stamps in a perfect row, the way men polish what they cannot use.',
        next: 'd5_m3_low',
      },
      {
        id: 'd5_m3_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'The post is on a war footing. Pandurang reads the order sheet: all ordinary transit suspended; the barracks district sealed; assemblies unlawful. "Today the Empire discovers who its servants are," he says. He looks at you a moment longer than at the others. Since April he has been "reviewing interceptions," and the review has never quite ended. Bomanji, at the next desk, has arranged his stamps in a perfect row, the way men polish what they cannot use.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'r5_suspend', text: 'All ordinary transit permits are suspended until further order. Gatherings of five or more persons are unlawful — organizers are to be detained.' },
      { id: 'r5_barracks', text: 'No person may pass within two furlongs of the Marine Barracks without a military pass. Immediate family of ratings may pass to the barracks gates on kinship papers, which must match the barracks roll and the bearer\'s identity paper.' },
      { id: 'r5_kinship', text: 'No person may pass within two furlongs of the Marine Barracks without a military pass. Immediate family of ratings may pass to the barracks gates on kinship papers, which must match the barracks roll and the bearer\'s identity paper.' },
      { id: 'r5_press', text: 'Press cards are valid only with the censor\'s countersign on the accompanying assignment letter. Strike bulletins and mutiny literature are seditious material — detain the bearer.' },
      { id: 'r5_assembly', text: 'All ordinary transit permits are suspended until further order. Gatherings of five or more persons are unlawful — organizers are to be detained.' },
      { id: 'r5_leaflets', text: 'Press cards are valid only with the censor\'s countersign on the accompanying assignment letter. Strike bulletins and mutiny literature are seditious material — detain the bearer.' },
      { id: 'r5_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
    ],
    cases: [
      {
        id: 'd5_c1',
        entrantName: 'Dhondiba Jadhav',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Kinship Papers',
            fields: [
              { label: 'Name', value: 'Dhondiba Jadhav, father of Rating S. Jadhav' },
              { label: 'Relationship', value: 'Father — stated in the papers, signed by the adjutant' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Barracks Roll Extract',
            fields: [
              { label: 'Ratings', value: 'Jadhav, S. — listed, No. 2 mess' },
              { label: 'Status', value: 'On refused rations' },
            ],
          },
          {
            kind: 'identity',
            title: 'Identity Paper',
            fields: [
              { label: 'Name', value: 'Dhondiba Jadhav' },
              { label: 'Village', value: 'Ahmadnagar district' },
              { label: 'Photograph', value: 'Affixed' },
            ],
          },
        ],
        entrantLine: '"My boy has not eaten from home in two years, sahib. Now he refuses their food and they call it mutiny. I am taking him bhakri." He carries a cloth bundle, flat and warm.',
        ruleIds: ['r5_kinship', 'r5_barracks', 'r5_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 5,
            text: 'Kinship papers in order. He goes through with his bhakri held close.',
          },
          deny: {
            crown: -3,
            conscience: -10,
            movement: -5,
            text: 'You deny valid kinship papers. He stands outside the cordon until dark, holding the bundle. The bhakri goes cold.',
          },
          detain: {
            crown: -5,
            conscience: -12,
            suspicion: 5,
            text: 'You detain a father carrying flatbread. The bundle is logged as property. Somewhere in the barracks a rating hears his father was taken, and the mutiny gains one more unforgiving man.',
          },
        },
      },
      {
        id: 'd5_c2',
        entrantName: 'Esther Pinto',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Press Card',
            fields: [
              { label: 'Name', value: 'Esther Pinto, staff correspondent' },
              { label: 'Valid until', value: 'December 1946' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Assignment Letter',
            fields: [
              { label: 'Salutation', value: '"To the officer at the cordon —"' },
              { label: 'From', value: 'Editor, The Bombay Chronicle' },
              { label: 'Body', value: 'Miss Pinto is assigned to report the disturbances at the Marine Barracks.' },
              { label: 'Censor\'s countersign', value: 'Absent — the censor\'s office is closed today' },
            ],
          },
        ],
        entrantLine: '"The censor\'s office is closed today, examiner. Convenient, no? The day the city most needs witnesses, the witness stamp is unavailable. I will report that too."',
        ruleIds: ['r5_press'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 5,
            suspicion: 8,
            text: 'No countersign; you pass her. The Empire notices. The Empire has a drawer for such notices.',
          },
          deny: {
            crown: 3,
            movement: -3,
            text: '"No countersign, no passage." She laughs — one note, like a stamp coming down. "Correct as always," she says, and writes something in her notebook while looking directly at you.',
          },
          detain: {
            crown: -3,
            conscience: -8,
            suspicion: 5,
            text: 'Detained. Her notebook is confiscated; her memory is not. She is released in an hour with everything she came for, because detention is also an interview if you are good at your job. She is.',
          },
        },
      },
      {
        id: 'd5_moral_orderly_chitty',
        entrantName: 'S. R. Bhandarkar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Military Pass, provost section',
            fields: [
              { label: 'Name', value: 'S. R. Bhandarkar, clerk, provost section' },
              { label: 'Valid', value: 'This week, countersigned by the adjutant' },
              { label: 'Cordon', value: 'Authorised within the two-furlong line' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Despatch Book, summons detail',
            fields: [
              { label: 'Contents', value: 'Eleven courts-martial summonses, to be served on next of kin' },
              { label: 'Names', value: 'Eleven ratings, listed by mess number' },
              { label: 'Instruction', value: 'Read the charge aloud to the family; note any remarks' },
            ],
          },
        ],
        entrantLine: '"Eleven houses to find, examiner. I read the charge to the mother or the wife, and I write down what she says. That is the work this week." He has ink on three fingers and the exhausted neutrality of a man delivering weather.',
        ruleIds: ['r5_barracks', 'r5_names', 'r5_suspend'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: -6,
            text: 'Military pass, countersigned, in order. You stamp him through, and eleven households get their summons read aloud, and their remarks noted.',
          },
          deny: {
            crown: -3,
            conscience: 3,
            suspicion: 3,
            text: 'You find a technicality — the despatch book is not a listed document — and hold him an hour. Eleven families get one more evening of not knowing, which they would not thank you for if they knew. He waits without resentment. He delivers weather; weather does not argue with gates.',
          },
          detain: {
            crown: -5,
            conscience: -3,
            suspicion: 5,
            text: 'You detain the adjutant\'s own clerk on a valid military pass, on the mutiny\'s third day. The provost section collects him with two military policemen who examine your desk the way surveyors examine ground.',
          },
        },
      },
      {
        id: 'd5_c3',
        entrantName: 'Shankar Manjrekar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'identity',
            title: 'Mill-worker Identity Paper',
            fields: [
              { label: 'Name', value: 'Shankar Manjrekar, mill committee man' },
              { label: 'Mill district', value: 'Fort' },
              { label: 'Photograph', value: 'Affixed' },
            ],
          },
          {
            kind: 'other',
            title: 'Strike Bulletins',
            fields: [
              { label: 'Count', value: 'Two hundred, mimeographed' },
              { label: 'Heading', value: '"Stand with the ratings. Down tools."' },
              { label: 'Carried', value: 'In a satchel, set openly on the counter' },
            ],
          },
        ],
        entrantLine: 'He knows you know. He sets the satchel on the counter himself, open, like a man paying a debt he is proud of. "Two hundred, examiner. Count them if you like."',
        ruleIds: ['r5_leaflets', 'r5_assembly', 'r5_suspend'],
        correct: 'detain',
        outcomes: {
          approve: {
            movement: 10,
            suspicion: 12,
            conscience: 5,
            text: 'You stamp a suspended transit and look away from the satchel. Two hundred bulletins go into the mill district on your authority. Tomorrow the mills will be emptier. Pandurang\'s "review" will be longer. The maths is simple and the bill is yours.',
          },
          deny: {
            crown: 2,
            movement: -3,
            conscience: -5,
            text: 'You deny the transit and let him keep the satchel — the half-measure again, your signature vice. He nods, almost kindly. "The bulletins will walk in without me, examiner," he says. He is right. That is not the comfort it should be.',
          },
          detain: {
            crown: 5,
            movement: -8,
            conscience: -8,
            flag: 'bulletin_man',
            text: 'Detained. He goes peacefully, satchel first, like a man checking luggage. "In August they took the printers," he says as the warder leads him off. "Now they take the readers. Next they will take the witnesses. Keep your stamp dry, examiner. You will need it."',
          },
        },
      },
      {
        id: 'd5_c4',
        entrantName: 'Unidentified youth, about twenty',
        entrantPortrait: 'madhav',
        portraitBg: 'curfew',
        documents: [
          {
            kind: 'other',
            title: 'Search-line Chit',
            fields: [
              { label: 'Papers', value: 'None on the person' },
              { label: 'Found', value: 'Inside the two-furlong cordon, no military pass' },
              { label: 'Condition', value: 'Cordite on his sleeve; a graze at the hairline' },
            ],
          },
        ],
        entrantLine: 'He keeps his face down. "Shankar Pawar, sahib. Mill hand." The lockups overflowed after the firing; half the boys taken in the April sweeps were back on the street by monsoon, and the street raised them. You know the set of those shoulders. You have known it since before he could walk. It is Madhav.',
        ruleIds: ['r5_barracks', 'r5_assembly'],
        correct: 'detain',
        outcomes: {
          approve: {
            movement: 10,
            conscience: 10,
            suspicion: 10,
            text: 'You write a false curfew endorsement on a blank slip — your own son, waved through your own desk, in Pandurang\'s direct line of sight. "Name checked. Pass on." It is the best stamp of your life. It may also be the last.',
          },
          deny: {
            conscience: -15,
            suspicion: 5,
            flag: 'madhav_arrested',
            text: '"No papers. Back to the van." He raises his face for the first time — just long enough for you to see that he understands, and that understanding is not the same as forgiveness. The van takes him to Blackwood House. The rule was followed. Somewhere, in a ledger the Empire keeps, that is a victory.',
          },
          detain: {
            crown: 8,
            conscience: -20,
            movement: -15,
            flag: 'madhav_arrested',
            text: 'You speak the word "detain" over your own son, because Pandurang is watching and the correct column demands it. Madhav does not resist. He says, very quietly, "It is all right, Baba," which you did not earn, and which you will spend the rest of your life trying to deserve.',
          },
        },
        risk: {
          p: 0.3,
          onFail: {
            flag: 'madhav_dead',
            conscience: -25,
            suspicion: 5,
          },
          onSuccess: {
            flag: 'madhav_saved',
            movement: 5,
            conscience: 5,
          },
          failText:
            'The warder at the gate recognizes him from the April description. Madhav runs. A rifle goes off the way rifles do at cordons — quickly, and then with paperwork. You are the one who identifies him. You are the one who signs the form. The form has a box for relationship to deceased. You write "father" in your best clerical hand.',
          successText:
            'The gate warder counts heads wrong — on purpose, you will always believe — and Madhav walks out of the search line into the city like a letter slipping out of a file. He is home by midnight. He does not speak. Neither do you. Radha serves dinner for the correct number of people, and it is the greatest meal of your life.',
        },
      },
      {
        id: 'd5_c5',
        entrantName: 'Rusi Wadia',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Medical Supplies Transit Permit, ordinary class',
            fields: [
              { label: 'Name', value: 'Rusi Wadia, driver, civil hospital contract' },
              { label: 'Class', value: 'Ordinary' },
              { label: 'Cargo', value: 'Medical supplies, civil hospital, Byculla' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Hospital Indent',
            fields: [
              { label: 'Salutation', value: '"To the checkpost examiner —"' },
              { label: 'From', value: 'Senior surgeon, civil hospital, Byculla' },
              { label: 'Body', value: 'Bearer carries morphia and bandages for the firing wounded. Every hour is paid for in blood.' },
            ],
          },
        ],
        entrantLine: '"The suspension is for processions, examiner. This is morphia. The firing wounded are in my hospital."',
        ruleIds: ['r5_suspend'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 3,
            conscience: 8,
            suspicion: 8,
            text: 'Suspended class, stamped through. The morphia reaches the civil hospital before the evening list of wounded does. Somewhere a form disagrees with a fact, and for once the fact wins, because you let it.',
          },
          deny: {
            crown: 3,
            conscience: -10,
            text: '"The class is suspended. Get a military escort order and return." He does not argue. He drives off to find an order that will take four hours, and the wounded will wait four hours, and the rule will have been obeyed to the letter, which is the whole problem with letters.',
          },
          detain: {
            crown: -5,
            conscience: -12,
            suspicion: 5,
            text: 'You detain a morphia lorry during a firing\'s aftermath. The hospital telephones. The deputy commissioner telephones. Pandurang releases the lorry himself and writes one more line in the book with your name at the top.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'd5_e1',
        bg: 'maidan',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { flagNot: 'madhav_arrested' },
        text:
          'On the way home you pass the maidan, where the crowd that gathered for the ratings has become a crowd that gathers for the dead. Domnic is there — Emil survived the harbour only to be laid off when the docks burned, and now he stands in solidarity queues with the strikers. "Both sides eat our children, Keshav," he says. "The Empire with rules, the Movement with glory. I have stopped clapping. I only count who comes home." He has said this before. He will keep saying it until someone listens.',
        next: 'd5_e1_low',
      },
      {
        id: 'd5_e1_low',
        bg: 'maidan',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'On the way home you pass the maidan, where the crowd that gathered for the ratings has become a crowd that gathers for the dead. Domnic is there, in the solidarity queue with the strikers because the docks laid him off and he has nowhere else to stand. "Both sides eat our children, Keshav," he says. "The Empire with rules, the Movement with glory. I only count who comes home." He does not know about today. He says it to the crowd, to himself, to the general air. You do not tell him what you counted.',
        next: 'd5_e2',
      },
      {
        id: 'd5_e2',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        requires: { suspicionMax: 44 },
        text:
          'You stayed late to finish the interception log, and there is a problem: the search-line screening this afternoon — your screening — has a gap where a false endorsement went out on your initials. Pandurang reviews the logs on Friday. Bomanji, stacking his perfect stamps, has not looked up from his work. He says, to his desk, in the voice of a man noting something for the record: "The intake ledger of March \'41, Damle. I have not forgotten."',
        next: 'd5_e2_low',
        choices: [
          {
            id: 'd5_e2_a',
            requires: { flag: 'bomanji_owes' },
            text: 'Let Bomanji square the duty log. He knows the gaps a reviewer skips.',
            effects: { suspicion: -15, conscience: -5, flag: 'log_squared', note: 'Bomanji rewrites three lines in a hand indistinguishable from yours, which is a skill, which is frightening, which is friendship. The review will find nothing. Men like Bomanji keep ledgers of kindness, and today a page comes due.' },
            next: 'd5_e3',
          },
          {
            id: 'd5_e2_b',
            text: 'Square the log yourself, tonight, alone.',
            risk: {
              p: 0.3,
              onFail: { suspicion: 20, conscience: -5 },
              onSuccess: { suspicion: -5, conscience: -3 },
              failText: 'Pandurang has already photographed the log — "routine procedure," he says, smiling for the first time in recorded memory. The alteration is visible. The review becomes an inquiry. The inquiry has your initials.',
              successText: 'You alter two lines in the lamp\'s small circle of light, hands steady, conscience not. Friday\'s review passes over the page like weather over a field. You have become a man who alters records at night. The stool fits you the same as ever. That is the frightening part.',
            },
            next: 'd5_e3',
          },
          {
            id: 'd5_e2_c',
            text: 'Leave the log as it is. Let Friday come.',
            effects: { suspicion: 15, conscience: 10, note: 'You initial the gap. Whatever it costs, it is yours and no one else\'s. Bomanji looks at you the way men look at weather they cannot farm in.' },
            next: 'd5_e3',
          },
        ],
      },
      {
        id: 'd5_e2_low',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'You stayed late to finish the interception log, and there is a problem: the search-line screening this afternoon — your screening — has a gap where a false endorsement went out on your initials. Pandurang reviews the logs on Friday. Bomanji, stacking his perfect stamps, has noticed you noticing. He says, to his desk, in the voice of a man terrifying himself: "The intake ledger of March \'41, Damle. I have not forgotten."',
        choices: [
          {
            id: 'd5_e2_a',
            requires: { flag: 'bomanji_owes' },
            text: 'Let Bomanji square the duty log. He knows the gaps a reviewer skips.',
            effects: { suspicion: -15, conscience: -5, flag: 'log_squared', note: 'Bomanji rewrites three lines in a hand indistinguishable from yours, which is a skill, which is frightening, which is friendship. The review will find nothing. Men like Bomanji keep ledgers of kindness, and today a page comes due.' },
            next: 'd5_e3',
          },
          {
            id: 'd5_e2_b',
            text: 'Square the log yourself, tonight, alone.',
            risk: {
              p: 0.3,
              onFail: { suspicion: 20, conscience: -5 },
              onSuccess: { suspicion: -5, conscience: -3 },
              failText: 'Pandurang has already photographed the log — "routine procedure," he says, smiling for the first time in recorded memory. The alteration is visible. The review becomes an inquiry. The inquiry has your initials.',
              successText: 'You alter two lines in the lamp\'s small circle of light, hands steady, conscience not. Friday\'s review passes over the page like weather over a field. You have become a man who alters records at night. The stool fits you the same as ever. That is the frightening part.',
            },
            next: 'd5_e3',
          },
          {
            id: 'd5_e2_c',
            text: 'Leave the log as it is. Let Friday come.',
            effects: { suspicion: 15, conscience: 10, note: 'You initial the gap. Whatever it costs, it is yours and no one else\'s. Bomanji looks at you the way men look at weather they cannot farm in.' },
            next: 'd5_e3',
          },
        ],
      },
      {
        id: 'd5_e3',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { householdMin: 55 },
        text:
          'A knock, late. Domnic, with a boy behind him — a rating, no older than Madhav, uniform torn, a crease wound along his arm gone bad. He jumped the barracks wall after the firing; the patrols are checking lodgings. "Nobody on this landing has seen him," Domnic says. A statement. The kind he makes when he has already thought it through and is waiting to see if you have too. The boy looks at your face and you watch him arrive at the correct conclusion: this is the house of an examiner.',
        next: 'd5_e3_low',
        choices: [
          {
            id: 'd5_e3_a',
            text: 'Take him in. The back room. Until the patrols pass.',
            risk: {
              p: 0.25,
              onFail: { suspicion: 25, flag: 'house_marked', conscience: 5 },
              onSuccess: { movement: 15, conscience: 15, flag: 'sheltered_rating' },
              failText: 'A patrol checks the chawl on the second night. The boy goes out the window and over the roofs and away — but the patrol remembers which door opened slowly. Your house is marked now, in the quiet way houses get marked: a line in a patrol book.',
              successText: 'Three nights. Radha feeds him without comment; Leela brings him water and asks him, gravely, whether sailors are brave, and he says, "Only the frightened ones, miss." On the fourth night he slips south with the harbour crews. You never learn his name. It is better that way, and worse.',
            },
            next: 'd5_e4',
          },
          {
            id: 'd5_e3_b',
            text: 'Take him as far as the hospital gate. No further.',
            effects: { movement: 5, conscience: 5, suspicion: 5, note: 'You walk him through three lanes with your examiner\'s face as his passport. At the hospital gate he salutes you — a mutineer, saluting a Crown examiner. Neither of you comments on it. There is nothing to say that would not make it smaller.' },
            next: 'd5_e4',
          },
          {
            id: 'd5_e3_c',
            text: 'Turn him away. This house has enough targets on its door.',
            effects: { conscience: -10, movement: -5, note: 'Domnic says nothing. The boy says, "It is all right, sir," which is Madhav\'s sentence, in another boy\'s mouth, on your own landing. You close the door. The door keeps closing, in your memory, for years.' },
            next: 'd5_e4',
          },
        ],
      },
      {
        id: 'd5_e3_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'A knock, late. Domnic, with a boy behind him — a rating, no older than Madhav, uniform torn, a crease wound along his arm gone bad. He jumped the barracks wall after the firing; the patrols are checking lodgings. "Nobody on this landing has seen him," Domnic says, which is not a question, and also is. He is asking something of a house that is already short. The boy looks at your face and you watch him arrive at the correct conclusion: this is the house of an examiner.',
        choices: [
          {
            id: 'd5_e3_a',
            text: 'Take him in. The back room. Until the patrols pass.',
            risk: {
              p: 0.25,
              onFail: { suspicion: 25, flag: 'house_marked', conscience: 5 },
              onSuccess: { movement: 15, conscience: 15, flag: 'sheltered_rating' },
              failText: 'A patrol checks the chawl on the second night. The boy goes out the window and over the roofs and away — but the patrol remembers which door opened slowly. Your house is marked now, in the quiet way houses get marked: a line in a patrol book.',
              successText: 'Three nights. Radha feeds him without comment; Leela brings him water and asks him, gravely, whether sailors are brave, and he says, "Only the frightened ones, miss." On the fourth night he slips south with the harbour crews. You never learn his name. It is better that way, and worse.',
            },
            next: 'd5_e4',
          },
          {
            id: 'd5_e3_b',
            text: 'Take him as far as the hospital gate. No further.',
            effects: { movement: 5, conscience: 5, suspicion: 5, note: 'You walk him through three lanes with your examiner\'s face as his passport. At the hospital gate he salutes you — a mutineer, saluting a Crown examiner. Neither of you comments on it. There is nothing to say that would not make it smaller.' },
            next: 'd5_e4',
          },
          {
            id: 'd5_e3_c',
            text: 'Turn him away. This house has enough targets on its door.',
            effects: { conscience: -10, movement: -5, note: 'Domnic says nothing. The boy says, "It is all right, sir," which is Madhav\'s sentence, in another boy\'s mouth, on your own landing. You close the door. The door keeps closing, in your memory, for years.' },
            next: 'd5_e4',
          },
        ],
      },
      {
        id: 'd5_e4',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The house is quiet. You have stopped listening for Madhav\'s step and started listening for the knock — every parent in Bombay knows the difference tonight. Radha has not asked what happened at the post.',
        next: undefined,
      },
    ],
    householdCost: 16,
    salary: 15,
    summaryText: 'Day 9 ends. The firing is over; the counting is not. Household -{cost}. The city has learned that the Empire will shoot its own sailors, and filed the knowledge where it keeps such things.',
  },

  // ==========================================================================
  // DAY 10 — APRIL 1946 — THE LEDGER AND THE NOISE (ordinary day)
  // ==========================================================================
  {
    day: 10,
    date: 'April 1946',
    title: 'The Ledger and the Noise',
    post: 'Fort',
    intro:
      'Bombay, April 1946. The mutiny is two months gone; the trials of the ratings drone on behind barracks walls like a radio in another room. The war\'s men are being poured back into the city, one discharge paper at a time, and the Empire — to cover the cost of having been an Empire — has raised the permit fee from two annas to four.',
    morning: [
      {
        id: 'n10_m1',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { suspicionMax: 44 },
        text:
          'Madhav is organizing for the ratings\' families fund — bail money, train fare home for the acquitted, rice for the wives of the convicted. He does it at the table now, in daylight, which is either courage or a reading of the Empire\'s exhaustion. "The government prosecutes them in the morning and demobilizes their ships\' companies in the afternoon," he says. "It is trying, Baba. You can feel it trying to hold everything. It has the grip of a tired man."',
        next: 'n10_m1_low',
      },
      {
        id: 'n10_m1_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav is organizing for the ratings\' families fund — bail money, train fare, rice. He does it at the table, in daylight, which is a different thing this week than it was last month. He stops when the stairwell door opens. "The government prosecutes them in the morning," he says, and then does not finish. Starts again: "Demobilizes the ships\' companies in the afternoon. The same morning and afternoon, Baba. Same morning." He is still watching the door. "It has the grip of a tired man. A tired man can still — " He does not finish that one either.',
        next: 'n10_m2',
      },
      {
        id: 'n10_m2',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { crownMin: 50 },
        text:
          'Pandurang announces the fee rise with the relish of a man reading somebody else\'s sentence. "Four annas. The queue will be angry. Anger is not grounds for waiver." He then distributes a memo on ink economy — the wartime ration has somehow survived the war — and a second memo clarifying that the first memo was to be countersigned. Bomanji reads both twice and begins, privately, to enjoy himself.',
        next: 'n10_m2_low',
      },
      {
        id: 'n10_m2_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang announces the fee rise without relish, which is worse. "Four annas. The queue will be angry. Anger is not grounds for waiver." He then distributes a memo on ink economy and a second memo clarifying that the first memo was to be countersigned. He sets yours on your desk and straightens it once. Bomanji watches this from behind his own memo and does not, this morning, begin to enjoy himself.',
        next: 'n10_m3',
      },
      {
        id: 'n10_m3',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        requires: { rupeesMin: 15 },
        text:
          '"Pension maths," Bomanji confides, showing you a column of figures kept in a diary labelled RASHI RECIPES. "If the service continues me at current grade, I retire on enough for rice and a roof. If it promotes me, rice, a roof, and a radio." He closes the diary. "Twenty years I have stamped correctly, Damle, and my whole future fits in a column next to a recipe for pumpkin. Do you ever wonder what it all sums to?"',
        next: 'n10_m3_low',
      },
      {
        id: 'n10_m3_low',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          '"Pension maths," Bomanji confides, showing you a column of figures kept in a diary labelled RASHI RECIPES. "If the service continues me at current grade, I retire on enough for rice and a roof. If it promotes me, rice, a roof, and a radio." He closes the diary. "Twenty years I have stamped correctly, Damle, and my whole future fits in a column next to a recipe for pumpkin. Do you ever wonder what it all sums to?" You have been running your own column since the fee went up and do not answer.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'rn10_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'rn10_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'rn10_fee', text: 'Permit fees are four annas. Permits whose fee receipt shows the old two-anna rate are incomplete.' },
      { id: 'rn10_discharge', text: 'Demobilized servicemen travel on discharge papers, which must bear the depot stamp and match the service booklet.' },
      { id: 'rn10_visits', text: 'Barracks visit passes require the ward office endorsement on the accompanying kinship certificate.' },
      { id: 'rn10_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
    ],
    cases: [
      {
        id: 'n10_c1',
        entrantName: 'Peter Gonsalves',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Discharge Papers, sappers',
            fields: [
              { label: 'Name', value: 'Peter Gonsalves, lance-naik, demobilized' },
              { label: 'Depot stamp', value: 'Present, dated this month' },
              { label: 'Service', value: 'Seven years, engineers' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Service Booklet',
            fields: [
              { label: 'Name', value: 'Peter Gonsalves' },
              { label: 'Rank', value: 'Lance-naik, sappers' },
              { label: 'Photograph', value: 'Affixed, depot-stamped' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Goa, sahib. My village has been told, by letter, to expect a hero." Seven years in the engineers, two of them bridging rivers — he carries his kitbag the way other men carry certificates.',
        ruleIds: ['rn10_discharge', 'rn10_seal', 'rn10_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            text: 'Depot stamp present, seal in order. He goes through toward a village in Goa that has been told, by letter, to expect a hero, and will receive instead a quiet man who can build bridges and cannot sleep through fireworks.',
          },
          deny: {
            crown: -3,
            conscience: -8,
            movement: -3,
            text: 'You deny valid discharge papers because the word "barracks" still raises your pulse. He salutes anyway — habit, not irony — and goes to queue again tomorrow, a man demobilized from everything except queues.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'Detained on valid discharge papers. The depot sends a sergeant to collect him, and the sergeant\'s look at your desk has seven years of bridging rivers behind it.',
          },
        },
      },
      {
        id: 'n10_moral_jail_endorsement',
        entrantName: 'Khurshid Bi',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Barracks Visit Pass',
            fields: [
              { label: 'Name', value: 'Khurshid Bi, mother of Rating D. Shaikh' },
              { label: 'Visit day', value: 'Saturday' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Kinship Certificate',
            fields: [
              { label: 'Names', value: 'Khurshid Bi, mother of Rating D. Shaikh' },
              { label: 'Ward office endorsement', value: 'Present, dated this week' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Sixty-one years, sahib, and I have learned how gates work. The paper is in order — I sat at the ward office till it was in order. But in my experience the paper is not what passes a woman through." Her hands are folded around something small.',
        bribeOffer: 'She unfolds four rupees onto the file, counted exactly, like a woman paying a bill she resents and cannot contest. "For your kindness, sahib. The other gates taught me to bring it."',
        ruleIds: ['rn10_visits', 'rn10_names', 'rn10_seal'],
        correct: 'approve',
        bribe: { amount: 4 },
        outcomes: {
          approve: {
            crown: 3,
            conscience: 5,
            text: 'Everything in order — and you push the four rupees back across the file before stamping. She looks at the money, then at you, revising sixty-one years of gates. She leaves the rupees on the counter anyway, out of habit, and comes back for them, out of poverty, and neither of you mentions it.',
          },
          deny: {
            crown: -3,
            conscience: -8,
            text: 'You deny a fully endorsed visit pass because the folded money made the file feel dirty. She retrieves her four rupees with the dignity of long practice and goes away believing the price has gone up. It has not. You simply declined to be what she expected, which at her age is its own insult.',
          },
          detain: {
            crown: -5,
            conscience: -10,
            suspicion: 5,
            text: 'Detained on valid papers, carrying a son\'s clean shirt. The barracks duty officer releases her with an apology, and her visit is logged as a detention. Her son will read that word beside his mother\'s name. Courts-martial are made of less.',
          },
          bribe: {
            household: 4,
            conscience: -8,
            note: 'Four rupees she did not owe, from a woman who budgeted for corruption and was not disappointed.',
            text: 'The four rupees go into the drawer. The stamp comes down on a file that was already clean. She thanks you for your kindness — the exact phrase, purchased — and goes to see her son. She will tell the lane that your gate costs four rupees. She will be wrong. She will also be right.',
          },
        },
      },
      {
        id: 'n10_c2',
        entrantName: 'Sonabai More',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Vendor\'s Transit Pass, vegetable seller',
            fields: [
              { label: 'Name', value: 'Sonabai More' },
              { label: 'Valid until', value: 'January 1947' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Fee Receipt',
            fields: [
              { label: 'Issued', value: 'March 1946' },
              { label: 'Amount', value: 'Two annas' },
            ],
          },
        ],
        entrantLine: '"I paid what the window asked, sahib. The window took two annas in March. Now I am told the year has changed the price of my own basket."',
        bribeOffer: 'She slides four rupees forward, exactly counted. "For the difference, sahib — and for your trouble in explaining it."',
        ruleIds: ['rn10_fee', 'rn10_seal', 'rn10_expiry'],
        correct: 'deny',
        bribe: { amount: 4 },
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Two annas short by decree; through anyway. She sells her vegetables. The fee rise exists to fill a war chest for a war that ended, and you have declined, in one small transaction, to collect it.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"The fee is four annas now. The receipt says two. Pay the difference at the window and return." She looks at the four rupees still lying on the file — the difference, by her arithmetic, already paid — and takes them back with the dignity of a woman retrieving a misunderstanding.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained over two annas. The vegetables wilt in the sun outside the post, which is a form of silent testimony. Released at dusk, she does not look at you; she looks at the vegetables.',
          },
          bribe: {
            household: 4,
            conscience: -4,
            note: 'Four rupees. The difference, plus a tip for your flexibility — her reading of the new rate, and now yours.',
            text: 'The four rupees join the drawer\'s small damp fellowship. The stamp comes down. She goes through with her basket, and you have both, in your way, paid the new fee — she in rupees, you in something the tin box cannot hold.',
          },
        },
      },
      {
        id: 'n10_c3',
        entrantName: 'Hormusji Driver',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Motor Mechanic\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Hormusji Driver' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'January 1946' },
              { label: 'Reverse', value: 'Fee receipt stamp, four annas' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"I know, I know," he says before you speak. "The workshop renewed everyone\'s but mine. A man who repairs engines, defeated by a calendar."',
        ruleIds: ['rn10_expiry', 'rn10_fee', 'rn10_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'Three months dead, stamped through. He touches the stamp like a reprieved man. Somewhere a motor runs that evening because you were kind, and the ledger of the Empire is wrong by exactly one engine\'s worth.',
          },
          deny: {
            crown: 3,
            text: '"Expired in January. The workshop can renew it in a day; make them." He grins — a man who has already accepted the errand and is only sorry about the walk. The easiest refusal of the month, and still it costs you something small and unrecorded.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained for an expired mechanic\'s pass. He spends the detention hour repairing the warder\'s bicycle, out of professional compulsion, and is released by a man riding it.',
          },
        },
      },
      {
        id: 'n10_c4',
        entrantName: 'Zulekha Bi',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Barracks Visit Pass',
            fields: [
              { label: 'Name', value: 'Zulekha Bi, wife of Rating I. Memon' },
              { label: 'Visit day', value: 'Thursday' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Kinship Certificate',
            fields: [
              { label: 'Names', value: 'Zulekha Bi, wife of Rating I. Memon' },
              { label: 'Ward office endorsement', value: 'Absent' },
            ],
          },
        ],
        entrantLine: '"The visit day is Thursday, sahib. I know it is Thursday. I came today because on Thursday the mill will not release me, and if I lose the mill we have nothing while they try him." She has brought him clean clothes, folded the way the wives of \'42 folded things.',
        ruleIds: ['rn10_visits', 'rn10_names', 'rn10_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 8,
            suspicion: 8,
            text: 'No endorsement; you pass her anyway. She sees her husband. The barracks clerk logs the visit under Thursday, because the clerks of the barracks have their own quiet arithmetic. You have added one entry to the Empire\'s long list of things that happened on the wrong day.',
          },
          deny: {
            crown: 3,
            conscience: -12,
            text: '"No endorsement. Thursday, with the ward office stamp." She folds the clean clothes back into the bundle — the folding of the wives of August, four years on, in different hands, unchanged. The rule has been correctly applied to a woman who did everything correctly except be born into a year with rules.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            suspicion: 5,
            text: 'You detain the wife of an accused rating for asking on the wrong day. The barracks releases her with the clean clothes unlogged. Somewhere her husband hears his wife was taken at the gate, and the Empire\'s case against him gains nothing but his hatred, which was not in short supply.',
          },
        },
      },
      {
        id: 'n10_c5',
        entrantName: 'Narayan Bhat',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Teacher\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Narayan Bhat, municipal school' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'October 1946' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Fee Receipt',
            fields: [
              { label: 'Issued', value: 'This month' },
              { label: 'Amount', value: 'Four annas' },
            ],
          },
        ],
        entrantLine: '"Four annas exactly, sahib — I stood at the window until they gave me the new stamp." A small civic miracle, correctly receipted.',
        ruleIds: ['rn10_seal', 'rn10_expiry', 'rn10_fee', 'rn10_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order, new fee correctly paid — a small civic miracle. He goes off to teach fractions to children who will inherit, among other things, the habit of being examined.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny a fully compliant pass because the day has made you suspicious of compliance. He queues again tomorrow, pays nothing more, and passes a different desk. The system absorbs your error the way soil absorbs rain: without objection, and without improvement.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained on a perfect file. The school sends a peon to enquire; the peon is nearly detained too, for enquiring, before Bomanji intervenes with the air of a man defusing his thousandth small bomb.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'n10_e1',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { movementMin: 65 },
        text:
          'Leela, thirteen, has been following the trials in the newspaper with the attention she once gave to your stamp pad. She sets the paper on the table between you. "Baba. The ratings asked for better food, and they are being tried for it." She waits. "At school they say the Empire is just. Which one is the lesson?" She already knows. She is waiting to see if you do.',
        next: 'n10_e1_low',
        choices: [
          {
            id: 'n10_e1_a',
            text: '"Both are lessons, Leela. That is what makes the second one a lie."',
            effects: { movement: 3, conscience: 3, note: 'She writes the sentence down — actually writes it — in the margin of her schoolbook, in pencil, over a rubbed-out sum.' },
            next: 'n10_e1b',
          },
          {
            id: 'n10_e1_b',
            text: '"Do your sums. The courts are not your syllabus."',
            effects: { crown: 3, conscience: -3, note: 'She returns to her sums. She has stopped expecting the truth from you on weekday evenings; she saves the real questions for Sundays now, and budgets for the disappointment.' },
            next: 'n10_e1b',
          },
        ],
      },
      {
        id: 'n10_e1_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'Leela, thirteen, finds you at the table before supper and does not sit. She has the newspaper folded to the trial reports. "Baba. The ratings asked for better food, and they are being tried for it. At school they teach us the Empire is just. One of these things is a lesson and one is a lie. I cannot decide which is which." She stands there. She does not look at her sums.',
        next: 'n10_e1b',
        choices: [
          {
            id: 'n10_e1_a',
            text: '"Both are lessons, Leela. That is what makes the second one a lie."',
            effects: { movement: 3, conscience: 3, note: 'She writes the sentence down — actually writes it — in the margin of her schoolbook, in pencil, over a rubbed-out sum.' },
            next: 'n10_e1b',
          },
          {
            id: 'n10_e1_b',
            text: '"Do your sums. The courts are not your syllabus."',
            effects: { crown: 3, conscience: -3, note: 'She returns to her sums. She has stopped expecting the truth from you on weekday evenings; she saves the real questions for Sundays now, and budgets for the disappointment.' },
            next: 'n10_e1b',
          },
        ],
      },
      {
        id: 'n10_e1b',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 10 },
        text:
          'The dhobi has stopped coming. Two rupees of arrears, carried since the trials began. "He washes the cantonment linen now," Radha says, straightening the shelf. "The Empire pays its washermen. Ours is the only door on the landing with no bundle on it." She has already counted the arrears; she is telling you what they are. Your office tunic, unironed, has begun to look like a rumour about you.',
        next: 'n10_e1b_low',
        choices: [
          {
            id: 'n10_e1b_a',
            text: 'Pay the two rupees. Bring the dhobi back.',
            effects: { rupees: -2, household: 2, conscience: 2, note: 'Two rupees. The bundle returns to the door on Thursday, and the tunic is pressed into respectability again. An examiner should not look like an accusation.' },
            next: 'n10_e2',
          },
          {
            id: 'n10_e1b_b',
            text: '"We wash at the tap like everyone else on the landing."',
            effects: { household: -3, conscience: -3, note: 'Radha washes the office tunic at the landing tap, in full view, with the flat of her hand on the stone. Domnic watches from his doorway. It is a kind of notice served.' },
            next: 'n10_e2',
          },
        ],
      },
      {
        id: 'n10_e1b_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The dhobi has stopped coming. Two rupees of arrears, carried since the trials began and the queue started paying four annas for everything including patience. "He washes the cantonment linen now," Radha says. "The Empire pays its washermen. Ours is the only door on the landing with no bundle on it." She says it without accusation, which is how you know it is one. Your office tunic, unironed, has begun to look like a rumour about you.',
        next: 'n10_e2',
        choices: [
          {
            id: 'n10_e1b_a',
            text: 'Pay the two rupees. Bring the dhobi back.',
            effects: { rupees: -2, household: 2, conscience: 2, note: 'Two rupees. The bundle returns to the door on Thursday, and the tunic is pressed into respectability again. An examiner should not look like an accusation.' },
            next: 'n10_e2',
          },
          {
            id: 'n10_e1b_b',
            text: '"We wash at the tap like everyone else on the landing."',
            effects: { household: -3, conscience: -3, note: 'Radha washes the office tunic at the landing tap, in full view, with the flat of her hand on the stone. Domnic watches from his doorway. It is a kind of notice served.' },
            next: 'n10_e2',
          },
        ],
      },
      {
        id: 'n10_e2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 15 },
        text:
          'Radha counts the tin box and finds it adequate. "The fee rise will mean longer queues and angrier mornings," she says. "And angrier mornings mean more of those small folded notes sliding across your desk." She looks at you steadily. "I do not ask where the extra rice money comes from anymore, Keshav. I have decided not to ask."',
        next: 'n10_e2_low',
      },
      {
        id: 'n10_e2_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha counts the tin box. She counts it twice — the second time without the box open, the way you know a sum before you have to show it. "The fee rise will mean longer queues," she says, closing the lid. "And angrier mornings." She does not say the rest of the sentence — the part about small folded notes. She moves a jar on the shelf instead. The jar was already in its place.',
        next: 'n10_e3',
      },
      {
        id: 'n10_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'You lie awake doing the day\'s sums: a bridge-builder stamped home, a vegetable seller\'s four rupees, a woman with folded clothes standing at the wrong gate on the right day of somebody else\'s week.',
        next: undefined,
      },
    ],
    householdCost: 16,
    salary: 15,
    summaryText: 'Day 10 ends. The trials drone on; the fees are up; the queue is angry and correct. Household -{cost}. The ledger and the noise, in their usual proportions.',
  },

  // ==========================================================================
  // DAY 11 — DECEMBER 1946 — THE APPROACHING LINE (ordinary day)
  // ==========================================================================
  {
    day: 11,
    date: 'December 1946',
    title: 'The Approaching Line',
    post: 'Fort',
    intro:
      'Bombay, December 1946. An interim government sits in Delhi and a commission draws lines on maps in London, and everyone in the queue can feel the ground being surveyed under their feet. Some families have begun to move before the line moves them. Others have begun to buy things they hope never to use.',
    morning: [
      {
        id: 'n11_m1',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 55 },
        text:
          'The Sheikhs on the second floor are leaving — twenty years across the landing, gone to relatives in the north with a tin trunk and no certainty of return. Radha has made them sheera for the journey; the good jar, extra cardamom. "Their Farida was born the same month as Leela," she says. "I have washed that child\'s face. Fed her. Braided her hair when her mother was ill." She goes back to the pot.',
        next: 'n11_m1_low',
      },
      {
        id: 'n11_m1_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The Sheikhs on the second floor are leaving — twenty years across the landing, gone to relatives in the north with a tin trunk and no certainty of return. Radha has made them sheera for the journey. "Their Farida was born the same month as Leela," she says. "I have washed that child\'s face." She goes back to the pot.',
        next: 'n11_m2',
      },
      {
        id: 'n11_m2',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { crownMin: 55 },
        text:
          'Pandurang has begun, discreetly, to pack. A photograph has come down from above his desk, leaving a pale rectangle like a stamp on the wall. "Transfers are coming," he says. "The service will be — reorganized." He pauses at your desk on his way out with a ledger — a thing without precedent — and says, without looking at you: "The record has been adequate, Damle. For what that is worth now." Bomanji, beside you, has started keeping a private copy of every new rule, in the recipe diary.',
        next: 'n11_m2_low',
      },
      {
        id: 'n11_m2_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang has begun, discreetly, to pack. A photograph has come down from above his desk, leaving a pale rectangle like a stamp on the wall. "Transfers are coming," he says, to the room, to himself. "The service will be — reorganized." It is the first time you have ever heard him use a word he could not define. He looks at you for three seconds longer than the sentence requires. Bomanji, beside you, has started keeping a private copy of every new rule, in the recipe diary.',
        next: 'n11_m3',
      },
      {
        id: 'n11_m3',
        bg: 'office',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { movementMin: 60 },
        text:
          'Madhav walks you to the post, something he has not done since he was twelve. "When it comes, Baba — when the flag changes — what happens to the queue?" You tell him the queue remains; only the seals are re-cut. He laughs, not with relief but with something harder. "Then we will make better seals," he says, "and better rules behind them — and we will know what those rules cost because we paid for every last one. That is the difference. That is the whole difference." At the gate he raises a hand and goes.',
        next: 'n11_m3_low',
      },
      {
        id: 'n11_m3_low',
        bg: 'office',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav walks you to the post, something he has not done since he was twelve. "When it comes, Baba — when the flag changes — what happens to the queue?" You tell him the queue remains; only the seals are re-cut. He is quiet a moment. "Then we will have to make better seals," he says, "and better rules behind them." At the gate he raises a hand and goes.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'rn11_seal', text: 'All papers must bear the district magistrate\'s seal. No seal, no passage.' },
      { id: 'rn11_expiry', text: 'Expired papers are void. Check the date on every document against today\'s date stamp.' },
      { id: 'rn11_rail', text: 'Travel to the northern provinces requires a rail warrant in addition to the transit pass. A letter from a relative is not a rail warrant.' },
      { id: 'rn11_weapons', text: 'No arms or blades above four inches may pass any checkpost. Bearers are to be detained.' },
      { id: 'rn11_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'rn11_permitno', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
    ],
    cases: [
      {
        id: 'n11_c1',
        entrantName: 'The Qureshi family',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Family Transit Pass',
            fields: [
              { label: 'Name', value: 'Yusuf Qureshi, his wife, two sons' },
              { label: 'Valid until', value: 'February 1947' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Rail Warrant',
            fields: [
              { label: 'Names', value: 'Yusuf Qureshi, his wife, two sons — four' },
              { label: 'Train', value: 'Northern mail, this week' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Family Manifest',
            fields: [
              { label: 'Names listed', value: 'Four, with ages' },
              { label: 'Baggage', value: 'Two trunks, one hold-all' },
            ],
          },
        ],
        entrantLine: '"We have read the newspapers, sahib. The newspapers do not love us back." They are leaving before the line arrives, while leaving is still a choice instead of a convulsion.',
        ruleIds: ['rn11_rail', 'rn11_names', 'rn11_seal', 'rn11_expiry'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            movement: 3,
            text: 'Warrant, pass, four names, four faces — in order. They go to the platform early, the way families with everything to lose go early. The queue behind them murmurs; the queue has been reading the same newspapers. You stamp, and the stamp is, for once, a small mercy with no asterisk.',
          },
          deny: {
            crown: -3,
            conscience: -10,
            movement: -5,
            text: 'You deny perfect papers because the murmur of the queue has got into your hand. They miss the morning train. There is an afternoon train. You will repeat "there is an afternoon train" to yourself for longer than the sentence deserves, and you will be right to.',
          },
          detain: {
            crown: -5,
            conscience: -12,
            suspicion: 5,
            text: 'Detained on valid papers, in this December, with those newspapers. The duty officer releases them with an apology and an escort to the platform, and the escort is the most honest document the office has issued all year.',
          },
        },
      },
      {
        id: 'n11_moral_tiffin',
        entrantName: 'Ganpat Kudalkar',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Transit Pass, refreshment-room cook',
            fields: [
              { label: 'Name', value: 'Ganpat Kudalkar, cook, going to a brother in Jhansi' },
              { label: 'Valid until', value: 'March 1947' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Bedding-roll Inspection Note',
            fields: [
              { label: 'Contents', value: 'Three kitchen knives, the longest nine inches, tools of trade' },
              { label: 'Bearer\'s service', value: 'Twelve years, station refreshment room' },
            ],
          },
        ],
        entrantLine: '"Twelve years at the refreshment room, sahib; now the room is closing and my brother has a dhaba in Jhansi. A cook without knives is a clerk without a pen." He unwraps them to show you: old, honest, sharpened to the spine. "These hands have fed lakhs of travellers. They have never fed on anyone."',
        ruleIds: ['rn11_weapons', 'rn11_seal', 'rn11_expiry'],
        correct: 'detain',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 3,
            movement: 3,
            text: 'Three kitchen knives, northbound, on your stamp. In this December the word "blades" has a meaning the cook does not intend and the rule does not care about. They will cut onions in Jhansi. Probably. Probably is the unit this job trades in.',
          },
          deny: {
            crown: 2,
            conscience: -3,
            text: '"Surrender the knives and the pass goes through. Or keep them and stay." He weighs his tools for a long moment — twelve years, honed to the spine — and hands them over like a man pawning his past. He goes north lighter by his whole trade.',
          },
          detain: {
            crown: 5,
            conscience: -10,
            text: 'The rule says blades above four inches: detain the bearer. You detain a refreshment-room cook. The knives are logged as weapons, which is the first time in twelve years anyone has called them that. He misses the week\'s train. In this December, a missed train is not a delay. It is a direction.',
          },
        },
      },
      {
        id: 'n11_c2',
        entrantName: 'Damodar Nadkarni',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Grain Movement Permit, sixty maunds',
            fields: [
              { label: 'Name', value: 'Damodar Nadkarni, provisions broker' },
              { label: 'Permit no.', value: 'G-5591' },
              { label: 'Valid until', value: 'June 1947' },
              { label: 'Seal', value: 'Seal impression, star motif; the star sits a shade too crisp for a five-year-old die' },
            ],
            sealState: 'forged',
          },
          {
            kind: 'manifest',
            title: 'Consignment Manifest',
            fields: [
              { label: 'Goods', value: 'Sixty maunds of wheat, northbound' },
              { label: 'Consignor', value: 'D. Nadkarni' },
              { label: 'Permit no. recorded', value: 'G-5519' },
            ],
          },
        ],
        entrantLine: 'Calm, well-dressed, faintly amused. "Everyone is moving grain north before the lines harden, examiner. I merely move it with better paper."',
        ruleIds: ['rn11_seal', 'rn11_permitno'],
        correct: 'detain',
        outcomes: {
          approve: {
            suspicion: 10,
            conscience: -5,
            text: 'You stamp it. Sixty maunds roll north on a seal that never sat in a magistrate\'s press. The grain will be sold where the fear is thickest, at fear\'s prices. "Better paper," he said. He did not say whose.',
          },
          deny: {
            crown: 3,
            suspicion: 3,
            text: '"The seal will need the magistrate\'s office to confirm it. The lorry stays." He smiles — the smile of a man whose costings already include this refusal — and reverses out of your jurisdiction. You have cost him an afternoon. You have not cost him the trade.',
          },
          detain: {
            crown: 5,
            text: 'You detain him and impound the permit. The magistrate\'s office confirms by telephone: no such number was ever issued. Pandurang initials the interception log and, for once, looks at you without pricing you.',
          },
        },
      },
      {
        id: 'n11_c3',
        entrantName: 'Bansilal Gupta',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Trader\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Bansi Lal Gupta' },
              { label: 'Valid until', value: 'March 1947' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'identity',
            title: 'Identity Paper',
            fields: [
              { label: 'Name', value: 'Bansilal Gupta' },
              { label: 'Trade', value: 'General trader' },
              { label: 'Photograph', value: 'Affixed, ward-office sealed' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"It is the same name, sahib. It has a gap in it. A man is not a different man because of a gap." He is half laughing; the queue behind him is not laughing at all.',
        ruleIds: ['rn11_names', 'rn11_seal'],
        correct: 'deny',
        outcomes: {
          approve: {
            suspicion: 6,
            conscience: 3,
            text: 'A gap in a name; you stamp it. He goes through delighted, declaring you the only reasonable examiner in the Presidency, loudly enough for Bomanji to hear, which you will pay for in wounded looks.',
          },
          deny: {
            crown: 3,
            conscience: -3,
            text: '"The names must match exactly. The ward office will close the gap in a day." He goes off to have a space removed from his own name, shaking his head at a civilization that cannot abide a small silence between syllables.',
          },
          detain: {
            crown: -3,
            conscience: -5,
            text: 'Detained over a space. In the current December, with the city\'s nerves the way they are, even the warder raises an eyebrow. He is released with instructions to "be one word, henceforth."',
          },
        },
      },
      {
        id: 'n11_c4',
        entrantName: 'Amrit Kaur',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Family Transit Pass',
            fields: [
              { label: 'Name', value: 'Amrit Kaur, travelling with her brother\'s family' },
              { label: 'Valid until', value: 'January 1947' },
              { label: 'Rail warrant', value: 'Not attached' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'letter',
            title: 'Brother\'s Letter',
            fields: [
              { label: 'Salutation', value: '"My dear sister —"' },
              { label: 'Posted', value: 'Lahore, last week' },
              { label: 'Body', value: 'All is arranged. I carry your rail warrant in my own bundle; show the pass at the gate and come quickly.' },
            ],
          },
        ],
        entrantLine: '"The warrant was in my brother\'s bundle, sahib. He has it. He is in Lahore. The paper and I have become separated by the whole point of the journey."',
        ruleIds: ['rn11_rail', 'rn11_seal', 'rn11_expiry'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 8,
            suspicion: 8,
            text: 'No warrant; you stamp her through to the platform anyway, onto a train you have no authority over, toward a brother holding her permission in his luggage. It is the wrong stamp and everyone at the grille knows it, and the queue — for once — does not murmur.',
          },
          deny: {
            crown: 3,
            conscience: -12,
            text: '"The warrant is required. Have your brother send it; the railway will hold your booking." The railway will not hold her booking; there is no mechanism; you both know the timetable of mercy does not connect. She nods, dry-eyed, a woman already calculating which possession buys a duplicate.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            suspicion: 5,
            text: 'You detain a woman for travelling toward her own family without a piece of paper her family is carrying. She is released at dusk. She misses the week\'s train. The week\'s train, in this December, is not a schedule; it is a closing door.',
          },
        },
      },
      {
        id: 'n11_c5',
        entrantName: 'Mohan Ranade',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Bank Clerk\'s Transit Pass',
            fields: [
              { label: 'Name', value: 'Mohan Ranade, Mercantile Bank' },
              { label: 'Ward', value: 'Fort' },
              { label: 'Valid until', value: 'May 1947' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: '"Only to the bank, sahib, and home again. As every day." An ordinary man on an unordinary month.',
        ruleIds: ['rn11_seal', 'rn11_expiry', 'rn11_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            text: 'In order. He goes off to count other people\'s money in a city quietly deciding whose money belongs to which future. An ordinary correct stamp on an unordinary month — the desk\'s bread and salt.',
          },
          deny: {
            crown: -3,
            conscience: -3,
            text: 'You deny a clean pass because the month has taught you to see omens in order. He adjusts his spectacles, finds no error in his papers, and departs with the fragile dignity of a man who has decided you are the error.',
          },
          detain: {
            crown: -5,
            conscience: -5,
            suspicion: 5,
            text: 'Detained on flawless papers. The bank telephones twice. Pandurang releases him personally and stands at your desk in the silence of a man deciding where to file this.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'n11_e1',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        requires: { movementMin: 60 },
        text:
          'Madhav is reading the Delhi reports aloud to anyone who will hold still. "An interim government. Our people, at desks, stamping things — Baba, at desks. Stamping things." He looks up, and there is no argument in his face and no question either, only the fact that has not finished staggering him. "Will it be different? When the hands on the stamps are ours?"',
        next: 'n11_e1_low',
        choices: [
          {
            id: 'n11_e1_a',
            text: '"The stamp does not change, Madhav. Only the hand. Make the hand better."',
            effects: { movement: 5, conscience: 3, note: 'He considers this with unusual seriousness. "Then the hand must remember being on the other side of the grille," he says. "Mine will. I intend to make a profession of remembering."' },
            next: 'n11_e2',
          },
          {
            id: 'n11_e1_b',
            text: '"It will be different because it must be. Leave it at that."',
            effects: { crown: 2, note: 'He lets it rest. Hope, at his age, does not require your signature — which is perhaps the first thing the boy has ever got without one.' },
            next: 'n11_e2',
          },
        ],
      },
      {
        id: 'n11_e1_low',
        bg: 'chawl',
        speaker: 'Madhav',
        portrait: 'madhav',
        text:
          'Madhav is reading the Delhi reports aloud to anyone who will hold still. "An interim government. Our people, at desks, stamping things." He looks up, and for once there is no argument in his face, only a question. "Will it be different, Baba? When the hands on the stamps are ours?"',
        choices: [
          {
            id: 'n11_e1_a',
            text: '"The stamp does not change, Madhav. Only the hand. Make the hand better."',
            effects: { movement: 5, conscience: 3, note: 'He considers this with unusual seriousness. "Then the hand must remember being on the other side of the grille," he says. "Mine will. I intend to make a profession of remembering."' },
            next: 'n11_e2',
          },
          {
            id: 'n11_e1_b',
            text: '"It will be different because it must be. Leave it at that."',
            effects: { crown: 2, note: 'He lets it rest. Hope, at his age, does not require your signature — which is perhaps the first thing the boy has ever got without one.' },
            next: 'n11_e2',
          },
        ],
      },
      {
        id: 'n11_e2',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        requires: { suspicionMax: 29 },
        text:
          'Domnic helps the Sheikhs carry their trunk down three flights, refusing every offer of help except Leela\'s. At the door he stands with the Sheikh for a long time, saying nothing, one hand on the old man\'s shoulder. Coming back up, he stops at your landing. "Twenty years," he says. "They borrowed my sugar. I borrowed their ladder. Now a line on a map in London has decided we were never neighbours." He goes in. The water tap, uncharacteristically, is silent.',
        next: 'n11_e2_low',
      },
      {
        id: 'n11_e2_low',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'Domnic helps the Sheikhs carry their trunk down three flights, refusing every offer of help except Leela\'s. At the door he stands with the Sheikh for a long time, saying nothing, one hand on the old man\'s shoulder. Coming back up, he stops at your landing and looks both ends of it before he speaks. "Twenty years," he says. "Their sugar and my ladder. A line on a map." He does not finish it. He goes in. The water tap, uncharacteristically, is silent.',
        next: 'n11_e2b',
      },
      {
        id: 'n11_e2b',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { rupeesMin: 10 },
        text:
          'The Sheikhs\' train is Friday. Radha has made the sheera; what she has not made is the parting gift, and the chawl is collecting — a rupee here, two there, the landing\'s whole savings of affection converted to cash for the journey. "Four rupees is our share if we are who we say we are," Radha says. "One rupee is also our share, if the month does not allow it." She sets the tin box on the table. "The month allows it."',
        next: 'n11_e2b_low',
        choices: [
          {
            id: 'n11_e2b_a',
            text: 'Give the four rupees. Twenty years is not tired arithmetic.',
            effects: { rupees: -4, household: 2, conscience: 5, note: 'Four rupees into the chawl\'s cloth bundle. The Sheikhs leave on Friday with the landing\'s whole heart converted to small notes. It will not save them. It was never meant to. It was meant to say who you were.' },
            next: 'n11_e3',
          },
          {
            id: 'n11_e2b_b',
            text: 'Give one rupee. The year has been expensive enough.',
            effects: { rupees: -1, household: -2, conscience: -3, note: 'One rupee. Radha carries it down herself and comes back without reporting how it was received. You do not ask. Some receipts are not read aloud.' },
            next: 'n11_e3',
          },
        ],
      },
      {
        id: 'n11_e2b_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'The Sheikhs\' train is Friday. Radha has made the sheera; what she has not made is the parting gift, and the chawl is collecting — a rupee here, two there, the landing\'s whole savings of affection converted to cash for the journey. "Four rupees is our share if we are who we say we are," Radha says. "One rupee is our share if we are tired this month. We are tired this month." She lays the tin box between you like a magistrate\'s seal.',
        choices: [
          {
            id: 'n11_e2b_a',
            text: 'Give the four rupees. Twenty years is not tired arithmetic.',
            effects: { rupees: -4, household: 2, conscience: 5, note: 'Four rupees into the chawl\'s cloth bundle. The Sheikhs leave on Friday with the landing\'s whole heart converted to small notes. It will not save them. It was never meant to. It was meant to say who you were.' },
            next: 'n11_e3',
          },
          {
            id: 'n11_e2b_b',
            text: 'Give one rupee. The year has been expensive enough.',
            effects: { rupees: -1, household: -2, conscience: -3, note: 'One rupee. Radha carries it down herself and comes back without reporting how it was received. You do not ask. Some receipts are not read aloud.' },
            next: 'n11_e3',
          },
        ],
      },
      {
        id: 'n11_e3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'You lie awake listening to a city rehearsing its own departure from itself. Somewhere trains are being booked by families who cannot say why they are going, only that the going has begun. Bomanji\'s recipe diary is full of copied rules now — a private ark of procedure — in case anyone later claims they never existed.',
        next: undefined,
      },
    ],
    householdCost: 15,
    salary: 16,
    summaryText: 'Day 11 ends. The line approaches; the queue shortens and lengthens with the newspapers. Household -{cost}. Twenty-year neighbours are becoming statistics with luggage.',
  },

  // ==========================================================================
  // DAY 12 — AUGUST 1947 — A LINE ON A MAP
  // ==========================================================================
  {
    day: 12,
    date: 'August 1947',
    title: 'A Line on a Map',
    post: 'Fort',
    intro:
      'Bombay, August 1947. At midnight the Empire ends. A new border has been drawn to the north with a pencil and a deadline, and the trains have already begun to run in both directions, full. The Crown\'s seals are scrap metal tonight. Tomorrow the queue will form again — there is always a queue — but the stamps will say something new.',
    morning: [
      {
        id: 'd6_m1',
        bg: 'dawn',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 40 },
        text:
          'Radha is awake before the fireworks, ironing. She has been at it since before you heard the crowd. "Twenty-two years," she says, folding the collar down flat. "A tin medal and a handshake." She holds the office tunic up against the window, where the first firework colours it briefly orange. "I have been married to the Empire\'s left hand," she says. "It is a fine hand. I have always wanted to know what it stamped with the right."',
        next: 'd6_m1_low',
        choices: [
          {
            id: 'd6_m1_a',
            text: '"It fed us. And I fed it. Those are the same sentence, Radha."',
            effects: { conscience: 5, note: 'She looks at you a long time. "I know," she says. "I have always known. It is the only thing I never had to forgive you for, because I ate too."' },
            next: 'd6_m2',
          },
          {
            id: 'd6_m1_b',
            text: '"Today it ends. Let the past keep its own ledger."',
            effects: { conscience: -3, note: '"The past keeps its ledger in the present, Keshav. You of all people." She says it gently, which is the worst way Radha says anything.' },
            next: 'd6_m2',
          },
        ],
      },
      {
        id: 'd6_m1_low',
        bg: 'dawn',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha is awake before the fireworks, ironing. She does not look up when you come in. "Twenty-two years of seals," she says, "and they give you a tin medal and sixteen rupees." She smooths the collar with the flat of her hand. The cuffs are fraying. "Sixteen rupees." She holds up the shirt. "I have been married to the Empire\'s left hand," she says. "It spent us well enough. I have been counting."',
        next: 'd6_m2',
        choices: [
          {
            id: 'd6_m1_a',
            text: '"It fed us. And I fed it. Those are the same sentence, Radha."',
            effects: { conscience: 5, note: 'She looks at you a long time. "I know," she says. "I have always known. It is the only thing I never had to forgive you for, because I ate too."' },
            next: 'd6_m2',
          },
          {
            id: 'd6_m1_b',
            text: '"Today it ends. Let the past keep its own ledger."',
            effects: { conscience: -3, note: '"The past keeps its ledger in the present, Keshav. You of all people." She says it gently, which is the worst way Radha says anything.' },
            next: 'd6_m2',
          },
        ],
      },
      {
        id: 'd6_m2',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        requires: { suspicionMax: 45 },
        text:
          'Pandurang is packing twenty-two years into one tin trunk. He is leaving for "home," a hill town he has not seen since his twenties, and his famous coldness has not melted so much as been carefully folded away with the rest. "One last task, Damle," he says. "The service records — detentions, interceptions, informers\' files. The incoming government would misunderstand them. Sign the certificate that they were destroyed by floodwater in \'44. There is a gratuity in it — fifteen rupees. Call it a pension the Crown forgot to pay." He says it like a filing instruction, which is what it is. The only question is what kind of clerk you are on your last day.',
        next: 'd6_m2_low',
        choices: [
          {
            id: 'd6_m2_a',
            text: 'Sign the false certificate. Take the gratuity.',
            flagrant: true,
            effects: { rupees: 15, conscience: -15, flag: 'false_report', crown: 5, note: 'FLAGRANT. Fifteen rupees of gratuity for a false report, signed in your best clerical hand. The files burn cleanly — every detention, every name. Somewhere in the smoke go Bhosle, the boys of the search line, and your own initials, which is, you understand, rather the point.' },
            next: 'd6_m3',
          },
          {
            id: 'd6_m2_b',
            text: 'Refuse. "Let the files answer for us, Pandurang. Both ways."',
            effects: { conscience: 10, suspicion: 5, note: 'He shrugs and burns what he can reach without your signature. "You always mistook the ledger for the man," he says. "Goodbye, Damle. You were almost adequate."' },
            next: 'd6_m3',
          },
          {
            id: 'd6_m2_c',
            text: 'Sign — but keep the informers\' pages out of the burn pile first.',
            flagrant: true,
            effects: { rupees: 15, conscience: -8, movement: 10, flag: 'false_report', suspicion: 5, note: 'FLAGRANT. You sign the lie and pocket the fifteen-rupee gratuity, but three folders of names go home under your shirt. The new government will find them on a desk that is no longer yours. Half corruption, half rescue — your signature vice, to the very end.' },
            next: 'd6_m3',
          },
        ],
      },
      {
        id: 'd6_m2_low',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          'Pandurang is packing twenty-two years into one tin trunk. He is leaving for "home," a hill town he has not seen since his twenties. His famous coldness has not melted at all. "Damle." He does not look up from the trunk. "The service records. Detentions, interceptions, informers\' files. Sign the certificate — floodwater, \'44." He latches the lid. "Fifteen rupees. Or the log goes to the new desk as it stands, with your initials where they are, and the incoming government will know exactly what it is reading." He closes the trunk. "You have always been a careful reader of instructions," he says. "Be one now."',
        next: 'd6_m3',
        choices: [
          {
            id: 'd6_m2_a',
            text: 'Sign the false certificate. Take the gratuity.',
            flagrant: true,
            effects: { rupees: 15, conscience: -15, flag: 'false_report', crown: 5, note: 'FLAGRANT. Fifteen rupees of gratuity for a false report, signed in your best clerical hand. The files burn cleanly — every detention, every name. Somewhere in the smoke go Bhosle, the boys of the search line, and your own initials, which is, you understand, rather the point.' },
            next: 'd6_m3',
          },
          {
            id: 'd6_m2_b',
            text: 'Refuse. "Let the files answer for us, Pandurang. Both ways."',
            effects: { conscience: 10, suspicion: 5, note: 'He shrugs and burns what he can reach without your signature. "You always mistook the ledger for the man," he says. "Goodbye, Damle. You were almost adequate."' },
            next: 'd6_m3',
          },
          {
            id: 'd6_m2_c',
            text: 'Sign — but keep the informers\' pages out of the burn pile first.',
            flagrant: true,
            effects: { rupees: 15, conscience: -8, movement: 10, flag: 'false_report', suspicion: 5, note: 'FLAGRANT. You sign the lie and pocket the fifteen-rupee gratuity, but three folders of names go home under your shirt. The new government will find them on a desk that is no longer yours. Half corruption, half rescue — your signature vice, to the very end.' },
            next: 'd6_m3',
          },
        ],
      },
      {
        id: 'd6_m3',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        requires: { conscienceMin: 40 },
        text:
          'Leela, fourteen, has made a flag out of a petition paper and orange and green dye, and it is crooked and it is perfect. She holds it toward you first, before anyone else — the way she once held out her school sums for the stamp. "Baba," she says, "is it ours now? The country. The checkpost. The stamp." She already knows. She is waiting to see what you say.',
        next: 'd6_m3_low',
        choices: [
          {
            id: 'd6_m3_a',
            text: '"It is ours, Leela. Which means the stamps are ours too. Remember what they cost."',
            effects: { conscience: 5, movement: 3, note: 'She nods, grave as a magistrate. Of all your children, she will forget nothing.' },
            next: 'd6_m4',
          },
          {
            id: 'd6_m3_b',
            text: '"It was always ours. It only had other people\'s seals on it."',
            effects: { movement: 5, note: 'She repeats the sentence to herself, memorizing it. Somewhere Madhav would have smiled.' },
            next: 'd6_m4',
          },
        ],
      },
      {
        id: 'd6_m3_low',
        bg: 'chawl',
        speaker: 'Leela',
        portrait: 'leela',
        text:
          'Leela, fourteen, has made a flag out of a petition paper and orange and green dye. She carries it carefully, like something that might be taken away. "Baba," she says. Then a pause. "Is it ours now? The country." She watches your face. "The checkpost. The stamp." She has learned to ask her questions in pieces, and wait between them. She is asking the question her whole childhood has been an examination of.',
        next: 'd6_m4',
        choices: [
          {
            id: 'd6_m3_a',
            text: '"It is ours, Leela. Which means the stamps are ours too. Remember what they cost."',
            effects: { conscience: 5, movement: 3, note: 'She nods, grave as a magistrate. Of all your children, she will forget nothing.' },
            next: 'd6_m4',
          },
          {
            id: 'd6_m3_b',
            text: '"It was always ours. It only had other people\'s seals on it."',
            effects: { movement: 5, note: 'She repeats the sentence to herself, memorizing it. Somewhere Madhav would have smiled.' },
            next: 'd6_m4',
          },
        ],
      },
      {
        id: 'd6_m4',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'The last day\'s rulebook is one page long and reads like an obituary and a birth announcement in the same column. Crown seals: void. Dominion passes: interim. Border traffic: transfer papers and rail warrants. Refugee certificates: one-way. Bomanji is staying on — "someone must teach the new government where the stamps are kept," he says, and it is the closest thing to patriotism he has ever expressed.',
        next: undefined,
      },
    ],
    rules: [
      { id: 'r6_crownvoid', text: 'All Crown seals and Crown-era permits are void. Interim Dominion passes only.' },
      { id: 'r6_border', text: 'Persons travelling to the northern Dominion require transfer papers AND a rail warrant, names matching across both. Refugee transit certificates are valid one-way only and must bear the Relief Office stamp.' },
      { id: 'r6_refugee', text: 'Persons travelling to the northern Dominion require transfer papers AND a rail warrant, names matching across both. Refugee transit certificates are valid one-way only and must bear the Relief Office stamp.' },
      { id: 'r6_weapons', text: 'No arms or blades above four inches may pass any checkpost. Bearers are to be detained.' },
      { id: 'r6_names', text: 'All papers presented must agree: name, permit number, ward. Papers that disagree with one another void the file.' },
      { id: 'r6_property', text: 'Authority records remain the property of the successor office. No files may leave the city.' },
    ],
    cases: [
      {
        id: 'd6_c1',
        entrantName: 'Cyril Snaith',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Embarkation Pass, home leave',
            fields: [
              { label: 'Name', value: 'Cyril Snaith, Records Officer, the Authority' },
              { label: 'Sailing', value: 'This week, home leave' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Trunk Inventory',
            fields: [
              { label: 'Contents', value: 'Forty pounds of Authority files — detention lists, informer names, interception logs' },
              { label: 'Declared as', value: '"Personal effects — souvenirs"' },
            ],
          },
        ],
        entrantLine: '"Home leave at last, examiner. One trunk, one taxi, one tide. A man should not keep history waiting."',
        bribeOffer: 'He fans fifteen rupees on the counter like a hand of cards. "Souvenirs," he says, airily. "Surely a fellow keeper of paper understands the sentimental value of files."',
        ruleIds: ['r6_property', 'r6_crownvoid'],
        correct: 'detain',
        bribe: { amount: 15, flagrant: true },
        outcomes: {
          approve: {
            suspicion: 8,
            text: 'You let the files through unbribed — forty pounds of other people\'s names, sailing home as souvenirs. The new government will reconstruct what it can. The names will not be consulted.',
          },
          deny: {
            crown: 3,
            text: '"Files stay. You may go." He weighs arguing and finds it unfashionable on the last day of Empire. He boards without the trunk, and the trunk goes into the successor office\'s keeping, where it will be read or burned by someone newer.',
          },
          detain: {
            crown: 4,
            text: 'Detained until embarkation, trunk impounded. He calls you "a clerk with delusions of archive," which is fair, which is exactly what you are, which is why the files are staying.',
          },
          bribe: {
            household: 15,
            conscience: -10,
            flag: 'files_loose',
            note: 'FLAGRANT. The last bribe of the old regime, and the names of the detained sail away to a sideboard in Surrey.',
            text: 'Fifteen rupees for looking away while forty pounds of names leave the city. Somewhere in those files are the printers of \'42 and the boys of the search line, reduced to luggage. The stamp comes down. The Empire ends. Business is business.',
          },
        },
      },
      {
        id: 'd6_c2',
        entrantName: 'Zainab and Imtiyaz Sheikh',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Transfer Papers',
            fields: [
              { label: 'Names', value: 'Zainab Sheikh, Imtiyaz Sheikh, and three children' },
              { label: 'Countersigned', value: 'Present, this week' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Rail Warrant',
            fields: [
              { label: 'Names', value: 'Five, matching the transfer papers' },
              { label: 'Train', value: 'The northern train, tonight' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Family Manifest',
            fields: [
              { label: 'Names listed', value: 'Five, with ages' },
              { label: 'Baggage', value: 'One tin trunk, a number chalked on it' },
            ],
          },
        ],
        entrantLine: '"Three generations of us are buried in Byculla, sahib. Our neighbours were good. The map was not." The chalk number on the trunk has been re-traced twice, carefully, the way one tends a grave.',
        ruleIds: ['r6_border', 'r6_names'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            movement: 3,
            text: 'Everything in order — rarer than rain this week. The stamp comes down and the family goes to the platform where the chalk-numbered trunks are stacked like a new geography. The train will be late. The trains are all late. They will wait. Waiting, at least, they know how to do.',
          },
          deny: {
            crown: -3,
            conscience: -10,
            movement: -5,
            text: 'You deny perfect papers because the crowd at the gate is ugly and you are afraid of what approval makes you. They miss the night train. There will be another train. You keep telling yourself there will be another train.',
          },
          detain: {
            crown: -5,
            conscience: -12,
            suspicion: 5,
            text: 'Detained on the last day, on nothing. They miss the train and stand in the detention pen with their numbered trunk, and the oldest child asks her mother a question you cannot hear, and the mother does not answer it, and you will never know what it was, and you will never forget that.',
          },
        },
      },
      {
        id: 'd6_moral_widow_train',
        entrantName: 'Amir Bano',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Refugee Transit Certificate',
            fields: [
              { label: 'Name', value: 'Amir Bano, widow, and three children' },
              { label: 'Direction', value: 'One-way, southbound from Rawalpindi' },
              { label: 'Relief Office stamp', value: 'Absent — the stamp table broke before her turn' },
            ],
          },
          {
            kind: 'manifest',
            title: 'Train Manifest',
            fields: [
              { label: 'Names listed', value: 'Four, matching the certificate' },
              { label: 'Issued by', value: 'Relief Office desk, border station' },
            ],
          },
        ],
        entrantLine: '"They stamped three hundred certificates before the crowd broke the table, sahib. Mine was three hundred and one. The train onward is tonight, and there is a house in Byculla my brother has kept for us." The children stand in a line, by size, holding the luggage and one another.',
        bribeOffer: 'Five rupees, counted from a fold of cloth. "It is everything but the tickets, sahib. The bangle went in Rawalpindi."',
        ruleIds: ['r6_refugee', 'r6_names'],
        correct: 'deny',
        bribe: { amount: 5 },
        outcomes: {
          approve: {
            conscience: 8,
            movement: 5,
            text: 'No Relief Office stamp; you stamp it anyway, on the last day, when every desk in the city is improvising. "The Byculla house, then," you say, and she goes to the platform with her four names and her three children, three hundred and first in a queue the crowd dissolved.',
          },
          deny: {
            crown: 3,
            conscience: -12,
            text: '"The certificate needs the Relief Office stamp. There is a desk at the terminus." The desk has a queue of two days and the train is tonight. She does not weep; Rawalpindi used up the weeping. She leads the children away in their line, by size, into a city that has just been born and is already refusing people.',
          },
          detain: {
            crown: -5,
            conscience: -12,
            suspicion: 5,
            text: 'Detained for a missing stamp on the last day of the old world. Bomanji takes the file out of your hand without a word and walks the family to the Relief desk himself, which is the nearest thing to mutiny he has ever committed.',
          },
          bribe: {
            household: 5,
            conscience: -6,
            suspicion: 3,
            note: 'Five rupees — everything but the tickets. The last bangle money of the old regime.',
            text: 'The five rupees join the tin box\'s long, mixed parentage. You stamp the unstamped certificate. She goes to Byculla, to the kept house, and never learns your name, which is a mercy, because she would have told the story kindly, and kindness is the wrong word for what you just sold her.',
          },
        },
        risk: {
          p: 0.35,
          onFail: { suspicion: 8, conscience: -3 },
          onSuccess: { conscience: 3 },
          failText: 'At the terminus the Relief desk checks her certificate, finds your stamp over a missing one, and holds the family overnight pending enquiry. By morning someone has smoothed it over — everyone is smoothing something this week — but the desk\'s log carries your number in pencil.',
          successText: 'The terminus desk is a mob scene; the clerk stamps her certificate without looking up, and your improvisation dissolves into the general improvisation of a country being born. The family reaches Byculla. The kept house is real. You allow yourself to believe the rest.',
        },
      },
      {
        id: 'd6_c3',
        entrantName: 'Hari Tulpule',
        portraitBg: 'office',
        documents: [
          {
            kind: 'other',
            title: 'Refugee Transit Certificate',
            fields: [
              { label: 'Name', value: 'Hari Tulpule and family' },
              { label: 'Certificate lists', value: 'Five names' },
              { label: 'Direction', value: 'One-way' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'manifest',
            title: 'Train Manifest',
            fields: [
              { label: 'Names listed', value: 'Six — including a daughter born on the train, four days ago, unlisted' },
              { label: 'Issued by', value: 'Relief Office desk at the last station' },
            ],
          },
        ],
        entrantLine: '"She was born between stations, sahib. The train did not stop for her; why should the manifest have?" The baby is asleep against her mother\'s shoulder, entirely unaware she is undocumented. It is her first political act.',
        ruleIds: ['r6_refugee', 'r6_names'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 5,
            conscience: 10,
            suspicion: 5,
            text: 'Six souls, five names. You stamp it. "The manifest will be corrected at the other end," you say, and you both pretend to believe it. The baby sleeps through her approval. May she sleep through worse. May there never be worse.',
          },
          deny: {
            crown: 3,
            conscience: -12,
            text: '"Five names on the certificate, six on the manifest. Return to the Relief Office for correction." The Relief Office queue is two days long. The rule has been applied to a four-day-old child, and the rule is satisfied, and no one else is. No one else ever is.',
          },
          detain: {
            crown: -5,
            conscience: -15,
            text: 'You detain a refugee family over a newborn\'s paperwork. Bomanji takes over the desk for the rest of the hour without being asked. He does not meet your eye. Men like Bomanji keep ledgers of everything.',
          },
        },
      },
      {
        id: 'd6_c4',
        entrantName: 'Bal Shinde',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Interim Dominion Pass',
            fields: [
              { label: 'Name', value: 'Bal Shinde, tinker by trade' },
              { label: 'Issued', value: 'This week' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Bedding-roll Inspection Note',
            fields: [
              { label: 'Contents', value: 'A revolver, wrapped in a dhoti' },
              { label: 'Bearer\'s explanation', value: '"For the roads"' },
            ],
          },
        ],
        entrantLine: '"For the roads, sahib. You have heard what the roads are." Everyone has heard what the roads are. The rule does not have ears.',
        ruleIds: ['r6_weapons'],
        correct: 'detain',
        outcomes: {
          approve: {
            suspicion: 8,
            conscience: 3,
            text: 'You stamp the pass and do not look in the roll twice. A revolver goes north in a tinker\'s bedding. On the roads, it may guard a family or feed a massacre; the stamp is silent on the difference, and so, tonight, are you.',
          },
          deny: {
            crown: 2,
            conscience: -3,
            text: '"Surrender the weapon or the pass. Not both through my gate." He surrenders the revolver with the reluctance of a man giving up his last argument, and goes through lighter and less safe.',
          },
          detain: {
            crown: 4,
            text: 'Detained, weapon logged. He does not protest. "Write in your book that I carried it for the roads," he says, "and that the roads are what they are." You write it. It is the only sentence in the log that is wholly true.',
          },
        },
      },
      {
        id: 'd6_c5',
        entrantName: 'Annasaheb Bhosle',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Domicile Pass, issued 1941',
            fields: [
              { label: 'Name', value: 'Annasaheb Bhosle, printer, lately of Blackwood House' },
              { label: 'Seal', value: 'Crown seal, lion motif' },
            ],
            sealState: 'valid',
          },
          {
            kind: 'other',
            title: 'Release Order',
            fields: [
              { label: 'From', value: 'Blackwood House' },
              { label: 'Name', value: 'Annasaheb Bhosle' },
              { label: 'Status', value: 'Released this week; no interim pass issued yet' },
            ],
          },
        ],
        entrantLine: 'You know the name. August, \'42. He is thinner than the file photograph and his hands have forgotten print. "I only want to go home to Girangaon, sahib, and see what is left of a press." He does not recognize you. Why would he? To him you were a stamp, not a face.',
        ruleIds: ['r6_crownvoid'],
        correct: 'deny',
        outcomes: {
          approve: {
            movement: 10,
            conscience: 10,
            suspicion: 5,
            flag: 'bhosle_free',
            text: 'The seal is void; the man is not. You stamp him through on the last day, when stamps are being re-cut anyway. "Girangaon gate," you say. He thanks the desk, the office, the abstract idea of passage. Let him. You were never owed the thanks, and both of you know exactly why.',
          },
          deny: {
            crown: 3,
            conscience: -10,
            text: '"The Crown seal is void. Take the release order to the interim office." He folds the void pass away — the neatly folded paper of the wives of August, five years later, in the husband\'s own hands. The interim office closes at six. He will make it. Probably. Probably is the unit this job trades in.',
          },
          detain: {
            crown: -5,
            conscience: -20,
            text: 'You detain a released detainee for carrying the paper they released him with. It is the single most correct act of your career, and the most obscene, and the gap between those two truths is the exact shape of your working life.',
          },
        },
      },
      {
        id: 'd6_c6',
        entrantName: 'Gopal Menon',
        portraitBg: 'office',
        documents: [
          {
            kind: 'permit',
            title: 'Interim Dominion Pass',
            fields: [
              { label: 'Name', value: 'Gopal Menon, clerk, returning to his family in Dadar' },
              { label: 'Issued', value: '11 August 1947' },
            ],
            sealState: 'valid',
          },
        ],
        entrantLine: 'He is humming something. Everyone is humming something. "Home to Dadar, sahib — and a happy independence to you, when it comes." Ordinary papers, ordinary man, ordinary evening: the queue\'s small gift to you on the last day.',
        ruleIds: ['r6_crownvoid'],
        correct: 'approve',
        outcomes: {
          approve: {
            crown: 3,
            conscience: 3,
            text: 'The last correct stamp of the old life lands on a clerk going home to Dadar. He wishes you a happy independence with the awkward sincerity of a man saying it for the first time. It is, you realize, the first time.',
          },
          deny: {
            crown: -3,
            conscience: -5,
            text: 'You deny a valid interim pass out of nothing but the habit of scrutiny. He laughs, thinking it a joke, then sees your face and goes to rejoin a queue that no longer exists. There is no stamp for what you are becoming.',
          },
          detain: {
            crown: -5,
            conscience: -8,
            suspicion: 5,
            text: 'Detained on Independence Day with perfect papers. Bomanji releases him personally and walks him to the gate, apologizing in three languages. He does not apologize for you. There are limits even to Bomanji.',
          },
        },
      },
    ],
    evening: [
      {
        id: 'd6_e1',
        bg: 'maidan',
        speaker: 'Narrator',
        text:
          'At midnight the lights come on all over the city at once, as if Bombay itself has been approved. The maidan is a sea of strangers embracing. Fireworks over the harbour where the Verenor burned. Bomanji weeps without embarrassment. Domnic and Emil are there with a pot of sanna they refuse to explain. Somewhere in the crowd is everyone you have ever stamped, in both columns, and the city is too busy being born to check any of their papers.',
        next: 'd6_e2',
      },
      {
        id: 'd6_e2',
        bg: 'curfew',
        speaker: 'Narrator',
        text:
          'Near the station approach, the joy thins. A knot of men — angry, drunk, certain — has cornered a family against a hoarding: a tin trunk, a chalked number, three children made small. The men have decided the family belongs on the other side of the new line, on the next train, now. There are no police. There is no rulebook tonight. There is only you, and the family has seen your face and mistaken it — correctly or not — for authority.',
        choices: [
          {
            id: 'd6_e2_a',
            text: 'Step between them. Put the old authority on like a coat, one last time.',
            risk: {
              p: 0.3,
              onFail: { household: -3, conscience: 5, suspicion: 5, flag: 'bruised_night' },
              onSuccess: { movement: 15, conscience: 15, flag: 'shielded_family' },
              failText: 'It works for a minute — the voice, the stance, twenty-two years of unquestioned stamp. Then someone swings, and you are on the ground with a split lip, watching the chalked trunk carried off through the fireworks. You walk home holding your side. Radha cleans the cut without asking.',
              successText: 'The voice works. Twenty-two years of stamping has left a residue of command you never asked for and finally spend well. The knot of men breaks apart the way crowds do — suddenly, and pretending it was their idea. You walk the family to the platform and stand with them until the train takes the chalked trunk north. No one thanks you. It is the best stamp you never made.',
            },
            next: 'd6_e3',
          },
          {
            id: 'd6_e2_b',
            text: 'Run for a constable. It is the correct procedure.',
            effects: { conscience: -10, movement: -5, note: 'The constable takes nine minutes to find. In nine minutes, a crowd and a hoarding and a family become only a crowd and a hoarding. The chalked trunk is gone. Correct procedure, correctly followed, arrived at the usual time: after.' },
            next: 'd6_e3',
          },
          {
            id: 'd6_e2_c',
            text: 'Walk home. You have stamped enough for one lifetime.',
            effects: { conscience: -15, movement: -10, household: 3, note: 'You walk home through the fireworks with your eyes on your own shoes. Radha has kept dinner. You eat it. Somewhere behind you, at the station approach, a night you chose not to enter is happening without you, and it will keep happening, in your head, on schedule, forever.' },
            next: 'd6_e3',
          },
        ],
      },
      {
        id: 'd6_e3',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        requires: { householdMin: 40 },
        text:
          'Radha is waiting up, though the city is loud enough to excuse any absence. On the table: the tin box, the rulebook you were supposed to return, and tea, already poured, exactly the colour she knows you take it. "Whatever you stamped today," she says, "it is done. Whatever you did not stamp, that is done too." She sits across from you — not beside you; she has always talked to you face-to-face. "Now tell me what is left, and we will decide what to do with it. That is what this house has always done." She has already made room at the table. She has always made room.',
        next: 'd6_e3_low',
      },
      {
        id: 'd6_e3_low',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          'Radha is waiting up. On the table: the tin box, the rulebook you were supposed to return, and tea — already poured, the right colour, but she has not pushed it toward you. "Whatever you stamped today," she says, "it is done." She looks at the tin box. "Whatever you did not stamp, that is done too." She sits. "Now tell me what is left." The box sits between you. "We will decide what to do with it. We have always had to." She waits. She has always waited.',
        next: 'd6_e4',
      },
      {
        id: 'd6_e4',
        bg: 'dawn',
        speaker: 'Narrator',
        text:
          'Tomorrow the queue will form again — there is always a queue — and the stamps will be new and the hands holding them will be Indian hands, and the rules will be written in the same ink as the old ones, because rules are rules and men are men. But tonight, for one night, the door of the checkpost stands open, and the wind off the harbour moves the papers on your desk like a hand turning pages, looking for the entry that says what it all meant. It is not there. It was never going to be there. It is in the tin box, and the folded shirts, and the handwriting you would know anywhere, and the names — all the names — that you read, and weighed, and stamped, and carried home.',
        next: undefined,
      },
    ],
    householdCost: 12,
    salary: 16,
    summaryText: 'Day 12 ends. The Empire has left; the queue has not. Salary +{salary}, Household -{cost}. The last pay envelope of the old service is settled in full — back pay, a tin medal, and sixteen rupees that no longer buy what twelve once did.',
  },
];

// ============================================================================
// ENDINGS — evaluated in listed order, first match wins.
// "Taken In" normally triggers mid-game when suspicion >= 100 (engine sets
// flag "arrested"); it is listed first so the final screen also honors it.
// ============================================================================

export const ENDINGS: Ending[] = [
  {
    id: 'taken_in',
    title: 'Taken In',
    subtitle: 'The file was yours all along',
    text:
      'They come for you the way you went for so many others: politely, with a form. Pandurang — or whoever inherited Pandurang\'s desk — reads the charges in the rain-announcing voice, and the strangest thing is how familiar the words are, because you have read them aloud a hundred times. The cell at Blackwood House has a grille not unlike your own, and on the other side of it a young examiner stamps your intake paper without meeting your eye. You want to tell him about the seal, the date, the face, and that the rest is weather. You do not. He will learn it the way you did.',
    condition: { flag: 'arrested' },
  },
  {
    id: 'what_it_cost',
    title: 'What It Cost',
    subtitle: 'The ledger, balanced; the house, empty',
    text:
      'The house survives on paper, which is to say it does not survive. The tin box holds the bribes of six years — famine money, file money, the small denominations of a soul sold by instalments — and there is rice in the jar, and no one at the table who meets anyone else\'s eye. Radha counts in silence now; she stopped counting aloud the year she stopped wanting you to hear. Whatever you saved the household with, it was the household. You were correct so often, and careful so always, and it turns out the thing the stamp was pressing down on, all those years, was you.',
    condition: { householdMax: 25 },
  },
  {
    id: 'last_loyal_man',
    title: 'The Last Loyal Man',
    subtitle: 'The Empire\'s most faithful clerk, in a country that no longer exists',
    text:
      'The Crown gives you a tin medal and a handshake, and the office keeps you on after, because someone must teach the new clerks where the stamps are kept. You teach them. You are very good. At the small farewell function a young officer praises your "unbroken record of correctness," and you sit among the folding chairs knowing exactly what the record cost and exactly who paid it. Madhav does not write. He has no use for the man who stamped his people through the gates — even the ones he let pass, especially those, because mercy from that desk was its own kind of wound. You were loyal to the seal. The seal was loyal to no one. That was the whole arrangement, and you were the last to understand it.',
    condition: { crownMin: 65, movementMax: 45 },
  },
  {
    id: 'one_of_the_others',
    title: 'One of the Others',
    subtitle: 'The stamp that learned to say yes',
    text:
      'Years later, in a Girangaon tea shop, a man you half-remember — a printer, once — grips your hand and says to the men around him, "This one. This one passed us when passing cost something." It is not forgiveness; you did enough at that desk that forgiveness would be a lie. It is a place to stand. Madhav is alive, and arguing with you at the dinner table again, which is the form his love has always taken. Radha counts the tin box aloud once more, and there is music in it. You spent six years stamping the Empire\'s paper, and the only stamps that mattered were the ones the rulebook told you not to make. You know that now. Knowing is not undoing. But it is a start.',
    condition: { movementMin: 65, madhavAlive: true },
  },
  {
    id: 'between_two_fires',
    title: 'Between Two Fires',
    subtitle: 'He warmed his hands at both and belonged to neither',
    text:
      'The Empire\'s men remember you as unreliable. The Movement\'s men remember you as the Empire. Both are right, which is the precise measurement of your six years: you bent the rules often enough to be suspect and enforced them often enough to be guilty. The desk keeps you on afterward — clerks are clerks, whichever flag flies over the stamp — and you grow old at a grille very like the old one, passing some and denying others, in a city that is yours now and treats you exactly the same. Radha says, on your fiftieth birthday, "We managed," and it is the truest epitaph available. You stood between two fires and were warmed by neither. You also were not burned. There are worse trades. You know. You made most of them.',
    condition: { movementMin: 45, crownMin: 45 },
  },
  {
    id: 'ordinary_man',
    title: 'An Ordinary Man',
    subtitle: 'He stamped the paper. He went home at six.',
    text:
      'History does not record Keshav Damle, which was the plan. He checked the seal, the date, the face; he bent where bending was survivable and stood where standing was; he came home at six more often than not. The children grew. The rice jar emptied and filled and emptied. On quiet evenings Radha asks what kind of day it was, and he says "the usual," and it usually was. Somewhere in the files of three offices there are forty thousand of his stamps, and not one of them says what he believed. He survived the Empire, the famine, the fire, the firing, and the night the flags changed, and his reward is exactly what he asked for: ordinariness, in a city finally free to be ordinary. It is not a triumph. It is a life. He takes it.',
    condition: {},
  },
];

// ============================================================================
// EVENT BEATS — day-start consequence chains
// The engine evaluates these in array order (most urgent first) at each day
// start and plays the FIRST chain whose `requires` matches and whose id flag
// is not yet set. Terminal beats carry effects.flag = chain id.
// ============================================================================

export interface EventChain {
  id: string;
  requires: Condition;
  beats: Beat[];
}

export const EVENT_BEATS: EventChain[] = [
  // --------------------------------------------------------------------------
  // The gravest chain: the household has been starving and Leela's fever does
  // not break. One last choice if the tin box can still answer for it.
  // --------------------------------------------------------------------------
  {
    id: 'leela_worst',
    requires: { householdMax: 10, flagNot: 'leela_worst' },
    beats: [
      {
        id: 'ev_leela_worst_1',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The fever does not break. It is nine days now, or ten — the household has lost count, which is how the household keeps from counting. Leela lies on the folded quilt that was her bed and is now her country, smaller each day, and when she wakes she asks for water, and when she does not wake you stand over her and count her breaths the way you once counted stamps. Radha has stopped speaking. The tin box is empty. The rice jar is empty. The arithmetic has arrived at the number it was always arriving at.',
        next: 'ev_leela_worst_2',
      },
      {
        id: 'ev_leela_worst_2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          '"There is a doctor on Grant Road who comes at night," Radha says, not looking up, in the voice she uses for prices. "Eight rupees. He does not ask names, and he does not come back for thanks." She sets the words down between you like two stones. "We do not have eight rupees." She does not say the rest. The rest is standing in the room with you, where Leela used to stand.',
        choices: [
          {
            id: 'ev_leela_worst_a',
            text: 'Send for the doctor who comes at night · −₹8',
            requires: { rupeesMin: 8 },
            effects: {
              rupees: -8,
              household: 10,
              conscience: 5,
              note: 'He comes at midnight, bag first, and works without speeches. By the third morning the fever loosens its hands. Leela asks for rice water, then rice, then — unforgivably, wonderfully — for a story. It is the best debt you will ever carry.',
            },
            next: 'ev_leela_worst_3a',
          },
          {
            id: 'ev_leela_worst_b',
            text: 'There is nothing left to sell but the watching. Keep the vigil.',
            effects: {
              household: -15,
              conscience: -25,
              flag: 'leela_gone',
              note: 'You keep the vigil. On the fourth night the breathing stops the way a tap stops — a hesitation, a drop, nothing. Radha closes her daughter\'s eyes with the flat of her hand, the same hand that washed your tunic, and the sound the house makes is no sound at all.',
            },
            next: 'ev_leela_worst_3b',
          },
        ],
      },
      {
        id: 'ev_leela_worst_3a',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'Recovery is slow and total, the way childhood is. Within the week Leela is sitting up to divide her rice with Madhav again, quarrelling over the larger half, and the quarrel is the finest sound the house has made in months. You do not tell her what the week very nearly cost. Children are owed a world in which it did not come this close.',
        effects: { flag: 'leela_worst' },
      },
      {
        id: 'ev_leela_worst_3b',
        bg: 'dawn',
        speaker: 'Narrator',
        text:
          'They are quick about it, the people who come for the small ones; the chawl has done this before and lends you its practised kindnesses — a length of cloth, four shoulders, a lane kept clear. Madhav does not cry. He stands at attention beside a grief too large for a boy\'s frame. Radha lights the lamp that evening, and the next, because lamps are lit. You return to the desk, and the stamp is in your hand, and the stamp weighs nothing at all now.',
        effects: { flag: 'leela_worst' },
      },
    ],
  },
  // --------------------------------------------------------------------------
  // Final suspicion omen: the photograph, the copied file. Arrest is close.
  // --------------------------------------------------------------------------
  {
    id: 'watched_3',
    requires: { suspicionMin: 88, flagNot: 'watched_3' },
    beats: [
      {
        id: 'ev_watched_3_1',
        bg: 'dawn',
        speaker: 'Narrator',
        text:
          'At the bus stop, a man in a clean shirt is reading yesterday\'s newspaper upside down. When the bus comes he does not board it. When you board it, he raises a box camera — brazen, aimed the way a pistol is aimed — and the shutter\'s small click goes through the morning crowd like a pebble through still water. Nobody else hears it. That is how you know it was for you.',
        next: 'ev_watched_3_2',
      },
      {
        id: 'ev_watched_3_2',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'Bomanji does not look up from his ledger, and his voice is the smallest you have ever heard it. "They came for your file today. Two men, not from the office. They copied the counts into a book and took the book away." He turns a page. "Do not thank me. There will be a record of this conversation too, and I would like mine to read correctly."',
        next: 'ev_watched_3_3',
      },
      {
        id: 'ev_watched_3_3',
        bg: 'dawn',
        speaker: 'Narrator',
        text:
          'You walk home the long way, past the sea, and try to feel the size of it. Men who are taken are taken first by photograph and then by van — everyone knows the shape of it. At the landing, the chawl is lit and ordinary. Radha is cooking. Leela is reading. You stand outside your own door for one full minute, memorising the sound, the way a man memorises a face before a long journey.',
        effects: { flag: 'watched_3' },
      },
    ],
  },
  // --------------------------------------------------------------------------
  // Hunger and monsoon fever: Radha falls ill. The doctor costs real money.
  // --------------------------------------------------------------------------
  {
    id: 'radha_sick',
    requires: { householdMax: 30, flagNot: 'radha_sick', dayIndexMax: 9 },
    beats: [
      {
        id: 'ev_radha_sick_1',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'Three weeks of thin dal and thinner rice, and now the fever has come in with the monsoon damp like a bill collector who knows the family. Radha does not go to bed; she sits down on the kitchen floor between one task and the next, and does not get up, and says, "It is the rain. Everyone has it." Her hands are hot, and the ledger she keeps in her head — the one kept to the last paisa — has started dropping figures.',
        next: 'ev_radha_sick_2',
      },
      {
        id: 'ev_radha_sick_2',
        bg: 'chawl',
        speaker: 'Radha',
        portrait: 'radha',
        text:
          '"The doctor is six rupees and the fever is free," she says, and tries to make it a joke, and cannot finish the smile. Leela watches from the doorway with her mother\'s exact stillness, learning it.',
        choices: [
          {
            id: 'ev_radha_sick_a',
            text: 'Pay for the doctor · −₹6',
            effects: {
              rupees: -6,
              household: 6,
              note: 'The doctor comes at dusk, smells the kitchen, and says "fever with hunger in it" the way a man names a familiar street. Quinine, and a broth you cannot afford. By morning the ledger is back in her voice.',
            },
            next: 'ev_radha_sick_3',
          },
          {
            id: 'ev_radha_sick_b',
            text: '"It is the rain. Everyone has it." Let it run its course.',
            effects: {
              household: -6,
              conscience: -6,
              note: 'It runs its course across nine days. She rises thinner and slower, with one more apology in her spine. She never mentions the doctor. That is how you know she remembers.',
            },
            next: 'ev_radha_sick_3',
          },
        ],
      },
      {
        id: 'ev_radha_sick_3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'The household eats around its own absence for a while, the way a chawl stair is worn hollow in the middle. Madhav divides his rice without being asked; Leela divides hers without being seen. The tin box is lighter, and the month\'s arithmetic is rewritten in Radha\'s head in a smaller hand.',
        effects: { flag: 'radha_sick' },
      },
    ],
  },
  // --------------------------------------------------------------------------
  // Pandurang after hours: the warning that is given once.
  // --------------------------------------------------------------------------
  {
    id: 'watched_2',
    requires: { suspicionMin: 70, flagNot: 'watched_2' },
    beats: [
      {
        id: 'ev_watched_2_1',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'The queue is gone, the shutters down, the ink put away, and you are tying the day\'s files when the light at the door changes. Pandurang. He has come back after hours, alone, which he has never done, and he closes the door behind him with the care of a man sealing evidence.',
        next: 'ev_watched_2_2',
      },
      {
        id: 'ev_watched_2_2',
        bg: 'office',
        speaker: 'Pandurang',
        portrait: 'pandurang',
        text:
          '"Your file is thicker than your service record, Damle." He says it the way other men say good evening. "Six years, and the irregularities column grows younger every year. In 1941 you were a stamp. In 1943 you were a rumour. Now you are a topic." He straightens a file on your desk that did not need straightening. "One more mistake, and it will not be a warning. A warning is what I am doing now, and I am doing it once."',
        next: 'ev_watched_2_3',
      },
      {
        id: 'ev_watched_2_3',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'He leaves without asking you anything, which is how you know the asking is over. The office settles back into itself — the desks, the pigeonholes, the smell of sealing wax and other people\'s lives. You take your tunic down from its peg and it is just cloth. That is the frightening thing: it is still just cloth, and you are still the man who wears it, and the file keeps thickening either way.',
        effects: { flag: 'watched_2' },
      },
    ],
  },
  // --------------------------------------------------------------------------
  // The Movement's friends are repaid in surveillance: a night raid.
  // --------------------------------------------------------------------------
  {
    id: 'movement_raids',
    requires: { movementMin: 70, flagNot: 'movement_raids' },
    beats: [
      {
        id: 'ev_movement_raids_1',
        bg: 'curfew',
        speaker: 'Narrator',
        text:
          'Boots on the stairs at two in the morning, and every door on the landing learning at once how quietly it can breathe. They do not knock. They read your name off a list, correctly, which is worse than knocking, and they come in the way weather comes in. Madhav is stood against the wall and asked his name twice. Leela is kept in the doorway by a hand on her head — gently, which is the worst touch of the night.',
        next: 'ev_movement_raids_2',
      },
      {
        id: 'ev_movement_raids_2',
        bg: 'curfew',
        speaker: 'Narrator',
        text:
          'They open the tin box and count it twice, and the second count is five rupees shorter than the first, and the man who does it does not bother to look pleased. They take Madhav\'s pamphlets and leave Madhav, which is its own message: the boy is worth a line in a book, and the book is where boys are kept. At the checkpoint down the road — one he is not manning, one nobody is manning — they stop him again on his morning errand, and ask the name a third time, so the list stays a living thing.',
        next: 'ev_movement_raids_3',
      },
      {
        id: 'ev_movement_raids_3',
        bg: 'dawn',
        speaker: 'Narrator',
        text:
          'By four they are gone, and the landing exhales one door at a time. Radha recounts the tin box and says the number aloud, once, the way you name a wound. You helped the Movement in ones and twos — a stamp here, a look away there — and it turns out sympathy has a filing system too. You are in it now, and the file, in its quiet way, has begun to watch back.',
        effects: { rupees: -5, conscience: -8, suspicion: 8, flag: 'movement_raids' },
      },
    ],
  },
  // --------------------------------------------------------------------------
  // Too loyal a stamp: the chawl decides what you are.
  // --------------------------------------------------------------------------
  {
    id: 'community_cold',
    requires: { crownMin: 70, flagNot: 'community_cold', dayIndexMax: 10 },
    beats: [
      {
        id: 'ev_community_cold_1',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'It happens so gradually that you date it only in retrospect, like the turning of milk. Domnic no longer returns your morning greeting — he studies the tap, the drain, the years you have shared a landing, anything but the examiner. The milkman holds out his hand for cash in advance, in the doorway, loud enough for the stairs to hear. Nobody holds the staircase door. Nobody ever held it, you tell yourself. But it used to be held.',
        next: 'ev_community_cold_2',
      },
      {
        id: 'ev_community_cold_2',
        bg: 'chawl',
        speaker: 'Domnic',
        portrait: 'anna',
        text:
          'You corner him, gently, at the tap. "A word, Domnic." He fills his vessel before he answers, which is its own answer. "The landing talks, Keshav," he says at last, not unkindly. "A man is known by which queue he feeds. Yours wears a uniform." He lifts the vessel onto his shoulder. "I only count who comes home. Lately I count the men your stamp keeps out."',
        next: 'ev_community_cold_3',
      },
      {
        id: 'ev_community_cold_3',
        bg: 'chawl',
        speaker: 'Narrator',
        text:
          'Radha has noticed before you say anything, because Radha notices. "The Sheikh\'s wife sent no halwa this year," she reports, in the voice she uses for prices. "Twenty years of halwa." She sets the rice down. Nothing has happened. Nothing is happening all day long, in every doorway, and it is the coldest weather this city has ever made.',
        effects: { household: -4, flag: 'community_cold' },
      },
    ],
  },
  // --------------------------------------------------------------------------
  // First suspicion omen: Bomanji's quiet word about the stamp counts.
  // --------------------------------------------------------------------------
  {
    id: 'watched_1',
    requires: { suspicionMin: 45, flagNot: 'watched_1' },
    beats: [
      {
        id: 'ev_watched_1_1',
        bg: 'office',
        speaker: 'Bomanji',
        portrait: 'bomanji',
        text:
          'Bomanji waits until Pandurang\'s door closes, then drifts past your desk carrying a file he does not open. "A word, Keshav," he says to the file. "Pandurang has been asking after your stamp counts. Not the errors — the counts. How many passed, how many turned back, on which days." He drifts on, smiling at the far wall as though he has told you the weather. "Counts are how they decide a man has opinions."',
        next: 'ev_watched_1_2',
      },
      {
        id: 'ev_watched_1_2',
        bg: 'office',
        speaker: 'Narrator',
        text:
          'The afternoon passes the way afternoons do, one paper at a time. But the word "counts" sits on the desk beside the stamp and will not be blotted. You have always believed the file was anonymous — forty-one papers a day, no names attached. It is beginning to occur to you that the file has a name. It is yours.',
        effects: { flag: 'watched_1' },
      },
    ],
  },
];
