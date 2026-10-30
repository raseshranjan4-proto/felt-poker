import { DeckKind } from './cards';
import { EvalRules, HandMode } from './evaluator';

export type Betting = 'NL' | 'PL' | 'FL';
export type Street = 'preflop' | 'flop' | 'turn' | 'river';

export interface Variant {
  id: string;
  name: string;
  /** Short tag for pills and the lobby list, e.g. "PLO5". */
  tag: string;
  family: 'holdem' | 'omaha';
  holeCards: number;
  deck: DeckKind;
  boards: 1 | 2;
  mode: HandMode;
  hiLo: boolean;
  betting: Betting[]; // allowed structures, first = default
  maxSeats: number;
  /** Discard down to `keep` hole cards once betting on `after` ends. */
  discard?: { count: number; after: Street };
  /** Courchevel: first flop card is dealt face up before preflop betting. */
  courchevel?: boolean;
  rules: EvalRules;
  blurb: string;
  howTo: string[];
}

const V = (v: Omit<Variant, 'rules'> & { rules?: EvalRules }): Variant => ({ rules: {}, ...v });

export const VARIANTS: Variant[] = [
  V({ id: 'nlhe', name: "No-Limit Hold'em", tag: 'NLHE', family: 'holdem', holeCards: 2, deck: 'full', boards: 1, mode: 'any', hiLo: false, betting: ['NL'], maxSeats: 9,
    blurb: 'Two hole cards, five on the board. Bet any amount up to all-in.',
    howTo: ['Make the best five-card hand from your 2 cards and the 5 on the board, using any combination.', 'Any bet from the minimum raise up to your whole stack.'] }),
  V({ id: 'plhe', name: "Pot-Limit Hold'em", tag: 'PLHE', family: 'holdem', holeCards: 2, deck: 'full', boards: 1, mode: 'any', hiLo: false, betting: ['PL'], maxSeats: 9,
    blurb: "Hold'em where the biggest bet is the size of the pot.",
    howTo: ["Same hands as No-Limit Hold'em.", 'The largest raise allowed is the size of the pot after you call.'] }),
  V({ id: 'flhe', name: "Fixed-Limit Hold'em", tag: 'FLHE', family: 'holdem', holeCards: 2, deck: 'full', boards: 1, mode: 'any', hiLo: false, betting: ['FL'], maxSeats: 9,
    blurb: 'Fixed bet sizes, four bets per round at most.',
    howTo: ['Bets and raises are one small bet (the big blind) preflop and on the flop, two on the turn and river.', 'A round is capped at one bet and three raises.'] }),
  V({ id: 'short', name: 'Short Deck (6+)', tag: 'Short Deck', family: 'holdem', holeCards: 2, deck: 'short', boards: 1, mode: 'any', hiLo: false, betting: ['NL'], maxSeats: 9, rules: { shortDeck: true },
    blurb: '36 cards, 2s through 5s removed. A flush beats a full house.',
    howTo: ['Deck runs 6 to Ace.', 'A flush beats a full house.', 'A-6-7-8-9 is the lowest straight.'] }),
  V({ id: 'royal', name: "Royal Hold'em", tag: 'Royal', family: 'holdem', holeCards: 2, deck: 'royal', boards: 1, mode: 'any', hiLo: false, betting: ['NL'], maxSeats: 6, rules: { royal: true },
    blurb: '20 cards, Tens through Aces only. Big hands every hand.',
    howTo: ['Deck is 10, J, Q, K, A in four suits.', 'The only straight is 10 to Ace.', 'Up to 6 players.'] }),
  V({ id: 'pineapple', name: 'Pineapple', tag: 'Pineapple', family: 'holdem', holeCards: 3, deck: 'full', boards: 1, mode: 'any', hiLo: false, betting: ['NL', 'PL'], maxSeats: 9, discard: { count: 1, after: 'preflop' },
    blurb: 'Three hole cards; throw one away before the flop.',
    howTo: ['Dealt 3 cards; after preflop betting, discard 1.', "Then play as Hold'em with your 2 remaining cards."] }),
  V({ id: 'crazy', name: 'Crazy Pineapple', tag: 'Crazy Pine', family: 'holdem', holeCards: 3, deck: 'full', boards: 1, mode: 'any', hiLo: false, betting: ['NL', 'PL'], maxSeats: 9, discard: { count: 1, after: 'flop' },
    blurb: 'Three hole cards; throw one away after the flop.',
    howTo: ['Dealt 3 cards; discard 1 after the flop betting round.', "Then play as Hold'em."] }),
  V({ id: 'irish', name: 'Irish', tag: 'Irish', family: 'holdem', holeCards: 4, deck: 'full', boards: 1, mode: 'any', hiLo: false, betting: ['NL', 'PL'], maxSeats: 9, discard: { count: 2, after: 'flop' },
    blurb: 'Four cards like Omaha, then discard two after the flop.',
    howTo: ['Dealt 4 cards; discard 2 after the flop betting round.', "From the turn on, play as Hold'em with any combination."] }),
  V({ id: 'plo4', name: 'Pot-Limit Omaha', tag: 'PLO', family: 'omaha', holeCards: 4, deck: 'full', boards: 1, mode: 'omaha', hiLo: false, betting: ['PL', 'NL'], maxSeats: 9,
    blurb: 'Four hole cards. Use exactly two of them with three from the board.',
    howTo: ['You must use exactly 2 hole cards and exactly 3 board cards.', 'Max raise is the size of the pot.'] }),
  V({ id: 'plo5', name: 'PLO5', tag: 'PLO5', family: 'omaha', holeCards: 5, deck: 'full', boards: 1, mode: 'omaha', hiLo: false, betting: ['PL'], maxSeats: 9,
    blurb: 'Five-card Omaha. Still exactly two from your hand.',
    howTo: ['Dealt 5 cards; use exactly 2 with 3 from the board.'] }),
  V({ id: 'plo6', name: 'PLO6', tag: 'PLO6', family: 'omaha', holeCards: 6, deck: 'full', boards: 1, mode: 'omaha', hiLo: false, betting: ['PL'], maxSeats: 7,
    blurb: 'Six-card Omaha. Huge hands, huge pots.',
    howTo: ['Dealt 6 cards; use exactly 2 with 3 from the board.', 'Up to 7 players.'] }),
  V({ id: 'o8', name: 'Omaha Hi-Lo (8 or better)', tag: 'O8', family: 'omaha', holeCards: 4, deck: 'full', boards: 1, mode: 'omaha', hiLo: true, betting: ['PL', 'FL'], maxSeats: 9,
    blurb: 'Pot splits between the best high hand and the best low.',
    howTo: ['Use exactly 2 hole + 3 board cards for each half.', 'Low hand: five different cards 8 or lower, Ace counts low; straights and flushes do not count against it.', 'With no qualifying low, the high hand wins the whole pot.'] }),
  V({ id: 'bigo', name: 'Big O', tag: 'Big O', family: 'omaha', holeCards: 5, deck: 'full', boards: 1, mode: 'omaha', hiLo: true, betting: ['PL'], maxSeats: 9,
    blurb: 'Five-card Omaha played Hi-Lo.',
    howTo: ['Dealt 5 cards; exactly 2 with 3 board cards.', 'Pot splits high and 8-or-better low.'] }),
  V({ id: 'courchevel', name: 'Courchevel', tag: 'Courchevel', family: 'omaha', holeCards: 5, deck: 'full', boards: 1, mode: 'omaha', hiLo: false, betting: ['PL'], maxSeats: 9, courchevel: true,
    blurb: 'Five-card Omaha with the first flop card shown before betting.',
    howTo: ['One board card is turned face up before preflop betting.', 'The other two flop cards follow as normal.'] }),
  V({ id: 'dbomaha', name: 'Double-Board Omaha', tag: 'Double-Board', family: 'omaha', holeCards: 4, deck: 'full', boards: 2, mode: 'omaha', hiLo: false, betting: ['PL'], maxSeats: 9,
    blurb: 'Two boards. Half of each pot goes to the best hand on each.',
    howTo: ['Two separate boards are dealt.', 'Each pot is split: half to the best hand on board 1, half on board 2.'] }),
];

export const COMING_SOON = ['7-Card Stud', 'Razz', 'Stud Hi-Lo', '5-Card Draw', '2-7 Triple Draw', 'Badugi', 'Open-Face Chinese', 'HORSE'];

export const variantById = (id: string): Variant => VARIANTS.find((v) => v.id === id) ?? VARIANTS[0];

export const bettingLabel: Record<Betting, string> = { NL: 'No-Limit', PL: 'Pot-Limit', FL: 'Fixed-Limit' };
