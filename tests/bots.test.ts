import { describe, expect, it } from 'vitest';
import { chooseDiscard, decide, estimateEquity } from '../shared/bot';
import { seededRng } from '../shared/cards';
import { PokerEngine } from '../shared/engine';
import { ARCHETYPES, PERSONAS } from '../shared/personas';
import { variantById, VARIANTS } from '../shared/variants';

describe('personas', () => {
  it('has 260 personas with unique names and ids', () => {
    expect(PERSONAS.length).toBe(Object.values(ARCHETYPES).reduce((t, a) => t + a.count, 0));
    expect(PERSONAS.length).toBe(260);
    expect(new Set(PERSONAS.map((p) => p.name)).size).toBe(260);
    expect(new Set(PERSONAS.map((p) => p.id)).size).toBe(260);
  });

  it('starts with the showcase personas', () => {
    expect(PERSONAS[0].name).toBe('Mara Okafor');
    expect(PERSONAS[0].archetype).toBe('shark');
  });
});

describe('equity', () => {
  it('Aces beat a random hand about 85% heads-up', () => {
    const eq = estimateEquity(variantById('nlhe'), ['Ah', 'As'], [[]], 1, 3000, seededRng(3));
    expect(eq).toBeGreaterThan(0.8);
    expect(eq).toBeLessThan(0.9);
  });
});

describe('discard choice', () => {
  it('keeps a pocket pair in Pineapple', () => {
    expect(chooseDiscard(['Kh', 'Kd', '4c'], [], 1)).toEqual(['4c']);
  });
});

describe('bots play every variant legally', () => {
  for (const v of VARIANTS) {
    it(v.name, () => {
      const rng = seededRng(v.id.length * 31);
      const seats = Math.min(6, v.maxSeats);
      const e = new PokerEngine({ variantId: v.id, betting: v.betting[0], sb: 50, bb: 100, ante: 0, maxSeats: seats, minBuyIn: 4000, maxBuyIn: 10000, turnSeconds: 30 }, rng);
      const ps = Array.from({ length: seats }, (_, i) => PERSONAS[i * 40 + 3]);
      ps.forEach((p, i) => e.sit(i, { playerId: p.id, name: p.name, avatar: '', isBot: true, personaId: p.id }, 10000));
      for (let hand = 0; hand < 4; hand++) {
        for (const s of e.seats) if (s && s.stack === 0) s.stack = 10000;
        e.startHand();
        let guard = 0;
        while (e.phase !== 'handover' && guard++ < 400) {
          if (e.phase === 'runout') { e.continueRunout(); continue; }
          if (e.phase === 'discard') {
            e.seats.forEach((s, i) => { if (s?.needsDiscard) expect(e.discard(i, chooseDiscard(s.hole, e.boards[0], v.discard!.count, v.rules))).toBe(true); });
            continue;
          }
          const i = e.toAct;
          expect(e.act(i, decide(e, i, ps[i], { tilt: 0 }, rng))).toBe(true);
        }
        expect(e.phase).toBe('handover');
      }
    });
  }
});
