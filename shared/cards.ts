// Cards are two-character strings: rank (23456789TJQKA) + suit (cdhs), e.g. "Ah", "Tc".
export type Card = string;

export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';

export type DeckKind = 'full' | 'short' | 'royal';

export const rankOf = (c: Card) => RANKS.indexOf(c[0]) + 2; // 2..14
export const suitOf = (c: Card) => c[1];

export function makeDeck(kind: DeckKind): Card[] {
  const minRank = kind === 'full' ? 2 : kind === 'short' ? 6 : 10;
  const deck: Card[] = [];
  for (const r of RANKS) {
    if (RANKS.indexOf(r) + 2 < minRank) continue;
    for (const s of SUITS) deck.push(r + s);
  }
  return deck;
}

export type Rng = () => number;

// Mulberry32: small seeded PRNG, used for tests and persona generation.
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(arr: T[], rng: Rng = Math.random): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RANK_NAMES: Record<number, [string, string]> = {
  2: ['Two', 'Twos'], 3: ['Three', 'Threes'], 4: ['Four', 'Fours'], 5: ['Five', 'Fives'],
  6: ['Six', 'Sixes'], 7: ['Seven', 'Sevens'], 8: ['Eight', 'Eights'], 9: ['Nine', 'Nines'],
  10: ['Ten', 'Tens'], 11: ['Jack', 'Jacks'], 12: ['Queen', 'Queens'], 13: ['King', 'Kings'], 14: ['Ace', 'Aces'],
};
export const rankName = (r: number, plural = false) => RANK_NAMES[r === 1 ? 14 : r][plural ? 1 : 0];

const SUIT_NAMES: Record<string, string> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
export const cardName = (c: Card) => `${rankName(rankOf(c))} of ${SUIT_NAMES[suitOf(c)]}`;

export function combinations<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const pick: T[] = [];
  const rec = (start: number) => {
    if (pick.length === k) { out.push(pick.slice()); return; }
    for (let i = start; i <= arr.length - (k - pick.length); i++) {
      pick.push(arr[i]);
      rec(i + 1);
      pick.pop();
    }
  };
  rec(0);
  return out;
}
