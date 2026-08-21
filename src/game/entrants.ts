// ============================================================================
// THE SEAL OF BOMBAY — entrant faces at the grille
// Deterministic mapping from desk-case id to one of the generic entrant
// busts. Cases with `entrantPortrait` (story characters) keep their bust.
// Every entrant gets a face.
// ============================================================================

import type { DocCase } from './script';

export type EntrantBust =
  | 'dockworker'
  | 'merchant'
  | 'fisherwoman'
  | 'student'
  | 'nurse'
  | 'porter'
  | 'widow'
  | 'sailor'
  | 'tailor'
  | 'boy'
  | 'beggar'
  | 'cook'
  | 'mechanic'
  | 'midwife'
  | 'teacher'
  | 'elder'
  | 'lass'
  | 'soldier'
  | 'sweeper'
  | 'clerk2';

const ALL_BUSTS: EntrantBust[] = [
  'dockworker',
  'merchant',
  'fisherwoman',
  'student',
  'nurse',
  'porter',
  'widow',
  'sailor',
  'tailor',
  'boy',
  'beggar',
  'cook',
  'mechanic',
  'midwife',
  'teacher',
  'elder',
  'lass',
  'soldier',
  'sweeper',
  'clerk2',
];

/** Thematic assignment, read from each case in script.ts. */
const CASE_BUSTS: Record<string, EntrantBust> = {
  // Day 1 — The Appointment
  d1_c1: 'merchant', // Hargovind Seth, cloth merchant
  d1_c2: 'porter', // Sakharam Pawar, Byculla mill hand
  d1_c3: 'boy', // Rama Anthone, milk vendor on his rounds
  d1_c4: 'clerk2', // Joseph D'Mello, commercial traveller (thin, bespectacled)
  d1_moral_seamstress: 'lass', // Sundrabai Jadhav, seamstress (young woman)
  d1_moral_husband_paro: 'fisherwoman', // Paro Nayak, working her fevered husband's pass (working woman; photo bust stays male — that mismatch IS the case)
  d3_moral_tarabai_rice: 'fisherwoman', // Tarabai Koli, famine mother (Koli fisherfolk)
  n4_moral_curfew_ward: 'widow', // Rambha Kadam, widow going to her dying son
  d4_moral_son: 'widow', // Mariam D'Costa, mother begging into the cordon
  n10_moral_jail_endorsement: 'midwife', // Khurshid Bi, old mother visiting the jail
  d6_moral_widow_train: 'lass', // Amir Bano, refugee widow (young)
  // Day 2 — August 1942
  d2_c1: 'tailor', // Annasaheb Bhosle, job printer (tradesman)
  d2_c2: 'nurse', // Mary Ferreira, staff nurse
  d2_c3: 'student', // Vasant Gokhale, Elphinstone student
  d2_c4: 'porter', // Dattaram Karmarkar, millworkers' welfare man
  d2_c5: 'widow', // Fatima Sheikh, widow with two children
  // Day 3 — 1943, famine year
  d3_c1: 'widow', // Bai Rukmini, four children, husband at the front
  d3_c2: 'merchant', // Chunilal Mehta, grain merchant
  d3_c3: 'sailor', // Solly Master, shipping agent (harbour man, not the merchant bust)
  d3_c4: 'lass', // Kusum Bhosle, young wife of a detainee
  d3_c5: 'beggar', // Genu and Laxmi Shinde, destitute couple off the road
  // Day 4 — The Harbour Fire
  d4_c4: 'boy', // "Milind Dalvi" — Madhav in disguise; face down, let the handwriting be the tell
  d4_c1: 'dockworker', // Caetano D'Souza, winch operator
  d4_c2: 'nurse', // Dr. Shirin Billimoria, physician
  d4_c3: 'student', // Triambak Shukla, young press photographer
  d4_c5: 'dockworker', // Bhikaji Kamble, coolie's brother
  // Day 5 — The Barracks Mutiny (d5_c4 is Madhav: story bust)
  d5_c1: 'elder', // Dhondiba Jadhav, a rating's old father with a bhakri bundle
  d5_c2: 'fisherwoman', // Esther Pinto, staff correspondent
  d5_c3: 'porter', // Shankar Manjrekar, mill committee man
  d5_c5: 'sailor', // Rusi Wadia, hospital contract driver
  // Day 6 — A Line on a Map
  d6_c1: 'clerk2', // Cyril Snaith, records officer
  d6_c2: 'widow', // Zainab Sheikh, leaving with her family
  d6_c3: 'porter', // Hari Tulpule, refugee father
  d6_c4: 'sweeper', // Bal Shinde, tinker by trade
  d6_c5: 'tailor', // Annasaheb Bhosle again — same printer as d2_c1
  d6_c6: 'clerk2', // Gopal Menon, young clerk
  // Day 2 (v2) — April 1941
  n2_c1: 'elder', // Trimbak Joshi, temple clerk, bows to the stamp
  n2_c2: 'porter', // Mahadu Sathe, Girangaon mill hand (borrowed pass)
  n2_c3: 'fisherwoman', // Gangabai Shirodkar, vendor
  n2_moral_notice_warrant: 'clerk2', // Tukaram Phadke, process-server, Small Causes bailiff's office
  n2_c4: 'cook', // Santoo Yadav, tiffin carrier with sixty lunches on his tray
  n2_c5: 'merchant', // Dinshaw Gandhi, tradesman
  // Day 4 (v2) — September 1942
  n4_c1: 'widow', // Janabai Kamat, seamstress on piece-work, a widow
  n4_c2: 'clerk2', // Ramchandra Sawant, despatch clerk
  n4_c3: 'elder', // Master Dinanath, municipal school teacher (male)
  n4_c4: 'porter', // Fakir Mahomed, tonga driver
  n4_c5: 'nurse', // Perin Bharucha, dispenser
  // Day 6 (v2) — July 1943
  n6_c1: 'merchant', // Shripad Velankar, tradesman
  n6_c2: 'sailor', // Kassim Vora, fish trader of the Sassoon Dock fleet
  n6_c3: 'dockworker', // Tukaram Bhise, construction gang
  n6_c4: 'widow', // Indu Paranjpe, widow bearing her husband's licence
  n6_c5: 'porter', // Vithoba Kale, carter
  // Day 8 (v2) — June 1944, Byculla checkpost
  n8_c1: 'porter', // Laxman Mhatre, Byculla mill hand
  n8_c2: 'teacher', // Gracy D'Costa, schoolteacher
  n8_c3: 'tailor', // Abdul Karim, tailor of Clare Road
  n8_c4: 'clerk2', // F. Bhesania, clerk to shipping agents
  n8_c5: 'midwife', // Parvati Apte, midwife
  // Day 10 (v2) — April 1946
  n10_c1: 'soldier', // Peter Gonsalves, demobilized lance-naik
  n10_c2: 'fisherwoman', // Sonabai More, vendor
  n10_c3: 'mechanic', // Hormusji Driver, motor mechanic
  n10_c4: 'lass', // Zulekha Bi, young wife of an accused rating
  n10_c5: 'elder', // Narayan Bhat, municipal school teacher (male)
  // Day 11 (v2) — December 1946
  n11_c1: 'porter', // Yusuf Qureshi, refugee father of two
  n11_c2: 'merchant', // Damodar Nadkarni, provisions broker
  n11_c3: 'tailor', // Bansilal Gupta, trader (not the merchant bust twice running)
  n11_c4: 'lass', // Amrit Kaur, travelling with her brother
  n11_c5: 'clerk2', // Mohan Ranade, bank clerk
};

/**
 * Deterministic fallback for any case id missing from the table. The final
 * Knuth multiplicative mix keeps sequential ids (d1_c1, d1_c2, …) from
 * clustering on one bust — the old plain `h % N` kept landing on 'merchant'.
 */
function hashBust(id: string): EntrantBust {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  h = (h * 2654435761) >>> 0;
  return ALL_BUSTS[h % ALL_BUSTS.length];
}

/** Thematic base bust for a case (map, then hash fallback). */
function baseBust(id: string): EntrantBust {
  return CASE_BUSTS[id] ?? hashBust(id);
}

/**
 * Per-day bust assignment. Starts from the thematic map / hash fallback, then
 * walks the day replacing any bust that repeats the previous case's face or
 * has already appeared twice today with the next free pool bust. The walk is
 * deterministic (offset seeded by dayIndex + caseIndex), so reloads and the
 * queue strip always agree with the grille.
 *
 * Story cases (entrantPortrait) are passed in too but their story bust always
 * wins at render time; their slot here is simply ignored by the caller.
 */
export function assignBusts(caseIds: string[], dayIndex = 0): EntrantBust[] {
  const counts = new Map<EntrantBust, number>();
  const out: EntrantBust[] = [];
  caseIds.forEach((id, i) => {
    let bust = baseBust(id);
    const prev = i > 0 ? out[i - 1] : undefined;
    if (bust === prev || (counts.get(bust) ?? 0) >= 2) {
      const start = (dayIndex * 7 + i * 3) % ALL_BUSTS.length;
      for (let k = 0; k < ALL_BUSTS.length; k++) {
        const cand = ALL_BUSTS[(start + k) % ALL_BUSTS.length];
        if (cand !== prev && (counts.get(cand) ?? 0) < 2) {
          bust = cand;
          break;
        }
      }
    }
    counts.set(bust, (counts.get(bust) ?? 0) + 1);
    out.push(bust);
  });
  return out;
}

/** Image path for the entrant's face at the grille. */
export function entrantBustSrc(c: DocCase, assigned?: EntrantBust): string {
  if (c.entrantPortrait) return `/bust_${c.entrantPortrait}.png`;
  return `/entrant_${assigned ?? baseBust(c.id)}.png`;
}

/**
 * Hand-picked mismatched faces for specific photoMismatch cases: the
 * photograph on the document is someone else entirely.
 */
const MISMATCH_BUSTS: Record<string, EntrantBust> = {
  n2_c2: 'soldier', // Mahadu Sathe, a young mill hand, holds his cousin's pass
  d1_moral_husband_paro: 'dockworker', // Paro Nayak holds her husband Raghu's pass — the photo is a man, the hands at the grille are hers
};

/**
 * Image path for the PHOTOGRAPH affixed to the document. Normally the same
 * face as at the grille; when the case flags `photoMismatch`, a different
 * bust from the entrant pool — that discrepancy is the tell.
 */
export function photoBustSrc(
  c: DocCase,
  assigned?: EntrantBust,
  avoid: EntrantBust[] = [],
): string {
  if (!c.photoMismatch) return entrantBustSrc(c, assigned);
  const bust = assigned ?? baseBust(c.id);
  // The photograph must differ from the entrant AND from adjacent entrants'
  // faces, or the tell reads as a printing error.
  const avoidSet = new Set<EntrantBust>([bust, ...avoid]);
  const preferred = MISMATCH_BUSTS[c.id];
  if (preferred && !avoidSet.has(preferred)) return `/entrant_${preferred}.png`;
  const idx = ALL_BUSTS.indexOf(bust);
  for (let k = 3; k < ALL_BUSTS.length + 3; k++) {
    const cand = ALL_BUSTS[(idx + k) % ALL_BUSTS.length];
    if (!avoidSet.has(cand)) return `/entrant_${cand}.png`;
  }
  return `/entrant_${ALL_BUSTS[(idx + 3) % ALL_BUSTS.length]}.png`;
}
