import { describe, expect, it } from 'vitest';
import { seededRng } from '../shared/cards';
import { PokerEngine, TableConfig } from '../shared/engine';
import { VARIANTS } from '../shared/variants';

const cfg = (over: Partial<TableConfig> = {}): TableConfig => ({
  variantId: 'nlhe', betting: 'NL', sb: 50, bb: 100, ante: 0, maxSeats: 6, minBuyIn: 4000, maxBuyIn: 10000, turnSeconds: 30, ...over,
});

function table(stacks: number[], over: Partial<TableConfig> = {}, seed = 1) {
  const e = new PokerEngine(cfg({ maxSeats: Math.max(6, stacks.length), ...over }), seededRng(seed));
  stacks.forEach((st, i) => e.sit(i, { playerId: `p${i}`, name: `P${i}`, avatar: '', isBot: true }, st));
  return e;
}

const total = (e: PokerEngine) => e.seats.reduce((t, s) => t + (s?.stack ?? 0), 0) + e.potTotal * (e.phase === 'handover' ? 0 : 1);

/** Plays a hand to the end with a simple policy so every code path gets exercised. */
function playOut(e: PokerEngine, policy: (i: number) => 'call' | 'raise' | 'fold' | 'allin' = () => 'call') {
  let guard = 0;
  while (e.phase !== 'handover' && guard++ < 500) {
    if (e.phase === 'runout') { e.continueRunout(); continue; }
    if (e.phase === 'discard') {
      e.seats.forEach((s, i) => { if (s?.needsDiscard) e.discard(i, s.hole.slice(0, e.variant.discard!.count)); });
      continue;
    }
    const i = e.toAct;
    const l = e.legal(i)!;
    const p = policy(i);
    if (p === 'fold') e.act(i, { type: l.canCheck ? 'check' : 'fold' });
    else if (p === 'allin' && l.canRaise) e.act(i, { type: 'raise', amount: l.maxTo });
    else if (p === 'raise' && l.canRaise) e.act(i, { type: 'raise', amount: l.minTo });
    else e.act(i, { type: 'call' });
  }
  expect(e.phase).toBe('handover');
}

describe('betting basics', () => {
  it('posts blinds and acts UTG first', () => {
    const e = table([10000, 10000, 10000, 10000]);
    e.startHand();
    expect(e.button).toBe(0);
    expect(e.seats[1]!.bet).toBe(50);
    expect(e.seats[2]!.bet).toBe(100);
    expect(e.toAct).toBe(3);
  });

  it('heads-up: button posts small blind and acts first preflop', () => {
    const e = table([10000, 10000]);
    e.startHand();
    expect(e.sbSeat).toBe(e.button);
    expect(e.toAct).toBe(e.button);
  });

  it('everyone folds to the big blind', () => {
    const e = table([10000, 10000, 10000]);
    e.startHand();
    e.act(e.toAct, { type: 'fold' });
    e.act(e.toAct, { type: 'fold' });
    expect(e.phase).toBe('handover');
    expect(e.result!.uncontested).toBe(true);
    expect(e.seats[2]!.stack).toBe(10050);
  });

  it('big blind gets the option when limped to', () => {
    const e = table([10000, 10000, 10000]);
    e.startHand();
    e.act(0, { type: 'call' });
    e.act(1, { type: 'call' });
    expect(e.toAct).toBe(2);
    expect(e.legal(2)!.canCheck).toBe(true);
    e.act(2, { type: 'check' });
    expect(e.street).toBe('flop');
    expect(e.boards[0]).toHaveLength(3);
  });

  it('pot-limit caps raises at the pot', () => {
    const e = table([10000, 10000, 10000, 10000], { betting: 'PL' });
    e.startHand();
    // UTG facing 100 with 150 in the pot: call 100 then raise 250 -> raise to 350
    expect(e.legal(3)!.maxTo).toBe(350);
  });

  it('fixed-limit raises in fixed units and caps at four bets', () => {
    const e = table([10000, 10000, 10000, 10000], { betting: 'FL', variantId: 'flhe' });
    e.startHand();
    expect(e.legal(3)!.minTo).toBe(200);
    expect(e.legal(3)!.maxTo).toBe(200);
    e.act(3, { type: 'raise' }); // 2 bets
    e.act(0, { type: 'raise' }); // 3
    e.act(1, { type: 'raise' }); // 4 = cap
    expect(e.legal(2)!.canRaise).toBe(false);
  });

  it('min-raise follows the last raise size', () => {
    const e = table([10000, 10000, 10000, 10000]);
    e.startHand();
    e.act(3, { type: 'raise', amount: 400 }); // raise of 300
    expect(e.legal(0)!.minTo).toBe(700);
  });
});

describe('all-ins and side pots', () => {
  it('builds a side pot and conserves chips', () => {
    const e = table([1000, 5000, 5000]);
    e.startHand();
    const before = 11000;
    playOut(e, () => 'allin');
    expect(total(e)).toBe(before);
    const labels = e.result!.pots.map((p) => p.label);
    expect(labels).toContain('Main pot');
    expect(e.result!.pots.find((p) => p.label === 'Main pot')!.amount).toBe(3000);
  });

  it('returns an uncalled bet', () => {
    // Button (big stack) shoves first, short stack calls all-in for less
    const e = table([9000, 2000]);
    e.startHand();
    playOut(e, () => 'allin');
    expect(total(e)).toBe(11000);
    expect(e.result!.pots.some((p) => p.label === 'Returned' && p.amount === 7000)).toBe(true);
  });
});

describe('every variant plays to the end and conserves chips', () => {
  for (const v of VARIANTS) {
    it(v.name, () => {
      for (let seed = 1; seed <= 25; seed++) {
        const n = Math.min(v.maxSeats, 2 + (seed % 5));
        const stacks = Array.from({ length: n }, (_, i) => 3000 + i * 1500);
        const e = table(stacks, { variantId: v.id, betting: v.betting[0], maxSeats: v.maxSeats }, seed);
        const sum = stacks.reduce((a, b) => a + b, 0);
        e.startHand();
        const rng = seededRng(seed * 7);
        playOut(e, () => (['call', 'raise', 'fold', 'allin'] as const)[Math.floor(rng() * 4)]);
        expect(total(e)).toBe(sum);
        if (v.discard) {
          for (const s of e.seats) if (s?.shown) expect(s.hole).toHaveLength(v.holeCards - v.discard.count);
        }
        if (!e.result!.uncontested) for (const b of e.boards) expect(b).toHaveLength(5);
      }
    });
  }
});

describe('splits', () => {
  it('Hi-Lo awards high and low halves', () => {
    const e = table([5000, 5000], { variantId: 'o8', betting: 'PL' });
    e.startHand();
    // Rig the hand
    e.seats[0]!.hole = ['Kh', 'Kc', '9s', 'Qd'];
    e.seats[1]!.hole = ['Ah', '5d', 'Jc', 'Th'];
    // deck pops from the end: flop Ks 7h 7d, turn 4c, river 2s
    e.deck = ['2s', '4c', '7d', '7h', 'Ks'];
    playOut(e, () => 'call');
    expect(e.boards[0]).toEqual(['Ks', '7h', '7d', '4c', '2s']);
    expect(e.result!.headline).toBe('Split pot · High to P0, Low to P1');
    expect(e.seats[0]!.stack).toBe(5000);
    expect(e.seats[1]!.stack).toBe(5000);
  });

  it('Double-Board splits each pot by board', () => {
    const e = table([5000, 5000], { variantId: 'dbomaha', betting: 'PL' });
    e.startHand();
    e.seats[0]!.hole = ['Kh', '9h', 'Qs', '8c'];
    e.seats[1]!.hole = ['2c', '3d', '4h', '6s'];
    // Board 1 hearts favour P0; board 2 pairs P1
    e.deck = ['Kd', '6c', '6d', '2h', '2d', 'Jh', 'Js', '7h', '3h', 'Ah'];
    playOut(e, () => 'call');
    expect(e.result!.pots[0].awards.map((a) => a.side).sort()).toEqual(['board1', 'board2']);
  });
});
