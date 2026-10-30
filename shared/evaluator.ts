import { Card, combinations, rankName, rankOf, suitOf } from './cards';

export type HandKind =
  | 'high' | 'pair' | 'twopair' | 'trips' | 'straight' | 'flush' | 'fullhouse' | 'quads' | 'straightflush';

export interface EvalRules {
  /** Short Deck: flush beats full house, A-6-7-8-9 is the low straight. */
  shortDeck?: boolean;
  /** Royal Hold'em: 20-card deck, so no wheel straight. */
  royal?: boolean;
}

export interface HighHand {
  score: number;
  kind: HandKind;
  name: string;
  cards: Card[]; // the cards that make the hand (5 once the board is out, fewer preflop)
}

export interface LowHand {
  score: number; // lower is better
  name: string;
  cards: Card[];
}

const BASE = 15;
const CAT_NORMAL: Record<HandKind, number> = {
  high: 0, pair: 1, twopair: 2, trips: 3, straight: 4, flush: 5, fullhouse: 6, quads: 7, straightflush: 8,
};
const CAT_SHORT: Record<HandKind, number> = { ...CAT_NORMAL, flush: 6, fullhouse: 5 };

function tiebreak(ranks: number[]): number {
  let s = 0;
  for (let i = 0; i < 5; i++) s = s * BASE + (ranks[i] ?? 0);
  return s;
}

/** Evaluates exactly 5 cards, or fewer (preflop helper: pairs and high cards only). */
export function evalCards(cards: Card[], rules: EvalRules = {}): HighHand {
  const ranks = cards.map(rankOf).sort((a, b) => b - a);
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  // Groups ordered by size, then rank: e.g. full house K K K 7 7 -> [13, 7]
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ordered = groups.flatMap(([r, n]) => Array(n).fill(r) as number[]);

  let kind: HandKind;
  let tb = ordered;
  let straightHigh = 0;

  if (cards.length === 5) {
    const flush = cards.every((c) => suitOf(c) === suitOf(cards[0]));
    if (counts.size === 5) {
      if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
      else if (!rules.royal && ranks[0] === 14) {
        const rest = ranks.slice(1).join(',');
        if (!rules.shortDeck && rest === '5,4,3,2') straightHigh = 5;
        if (rules.shortDeck && rest === '9,8,7,6') straightHigh = 9;
      }
    }
    if (straightHigh && flush) { kind = 'straightflush'; tb = [straightHigh]; }
    else if (groups[0][1] === 4) kind = 'quads';
    else if (groups[0][1] === 3 && groups[1][1] === 2) kind = 'fullhouse';
    else if (flush) { kind = 'flush'; tb = ranks; }
    else if (straightHigh) { kind = 'straight'; tb = [straightHigh]; }
    else if (groups[0][1] === 3) kind = 'trips';
    else if (groups[0][1] === 2 && groups[1][1] === 2) kind = 'twopair';
    else if (groups[0][1] === 2) kind = 'pair';
    else kind = 'high';
  } else {
    const top = groups[0]?.[1] ?? 0;
    kind = top === 4 ? 'quads' : top === 3 ? 'trips' : top === 2 ? (groups[1]?.[1] === 2 ? 'twopair' : 'pair') : 'high';
  }

  const cat = (rules.shortDeck ? CAT_SHORT : CAT_NORMAL)[kind];
  return { score: cat * BASE ** 5 + tiebreak(tb), kind, name: describe(kind, tb), cards };
}

function describe(kind: HandKind, r: number[]): string {
  switch (kind) {
    case 'straightflush': return r[0] === 14 ? 'Royal flush' : `Straight flush, ${rankName(r[0])} high`;
    case 'quads': return `Four of a kind, ${rankName(r[0], true)}`;
    case 'fullhouse': return `Full house, ${rankName(r[0], true)} over ${rankName(r[3], true)}`;
    case 'flush': return `Flush, ${rankName(r[0])} high`;
    case 'straight': return `Straight, ${rankName(r[0])} high`;
    case 'trips': return `Three of a kind, ${rankName(r[0], true)}`;
    case 'twopair': return `Two pair, ${rankName(r[0], true)} and ${rankName(r[2], true)}`;
    case 'pair': return r[2] ? `Pair of ${rankName(r[0], true)}, ${rankName(r[2])} kicker` : `Pair of ${rankName(r[0], true)}`;
    default: return `High card, ${rankName(r[0])}`;
  }
}

export type HandMode = 'any' | 'omaha';

/**
 * Best high hand. 'any' = best 5 of hole + board (Hold'em family).
 * 'omaha' = exactly 2 hole cards + exactly 3 board cards.
 */
export function bestHigh(hole: Card[], board: Card[], mode: HandMode, rules: EvalRules = {}): HighHand {
  if (board.length < 3) {
    // Preflop helper: Omaha shows the best pair in hand, Hold'em the whole hand
    if (mode === 'omaha') {
      let best: HighHand | null = null;
      for (const pair of combinations(hole, 2)) {
        const h = evalCards(pair, rules);
        if (!best || h.score > best.score) best = h;
      }
      return best!;
    }
    return evalCards(hole.concat(board), rules);
  }
  let best: HighHand | null = null;
  const consider = (five: Card[]) => {
    const h = evalCards(five, rules);
    if (!best || h.score > best.score) best = h;
  };
  if (mode === 'omaha') {
    const boardTrips = combinations(board, 3);
    for (const two of combinations(hole, 2)) for (const three of boardTrips) consider(two.concat(three));
  } else {
    for (const five of combinations(hole.concat(board), 5)) consider(five);
  }
  return best!;
}

const lowRank = (c: Card) => (c[0] === 'A' ? 1 : rankOf(c));

function evalLow5(five: Card[]): LowHand | null {
  const rs = five.map(lowRank);
  if (rs.some((r) => r > 8) || new Set(rs).size !== 5) return null;
  const sorted = rs.sort((a, b) => b - a);
  const score = sorted.reduce((s, r) => s * BASE + r, 0);
  return { score, cards: five, name: `Low ${sorted.map((r) => (r === 1 ? 'A' : String(r))).join('-')}` };
}

/** Best 8-or-better low (A-5 lowball, straights and flushes ignored). Null when no low qualifies. */
export function bestLow(hole: Card[], board: Card[], mode: HandMode): LowHand | null {
  if (board.length < 3) return null;
  let best: LowHand | null = null;
  const consider = (five: Card[]) => {
    const l = evalLow5(five);
    if (l && (!best || l.score < best.score)) best = l;
  };
  if (mode === 'omaha') {
    const boardTrips = combinations(board, 3);
    for (const two of combinations(hole, 2)) for (const three of boardTrips) consider(two.concat(three));
  } else {
    for (const five of combinations(hole.concat(board), 5)) consider(five);
  }
  return best;
}
