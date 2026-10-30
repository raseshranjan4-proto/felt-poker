import { describe, expect, it } from 'vitest';
import { bestHigh, bestLow, evalCards } from '../shared/evaluator';

const h = (s: string) => s.split(' ');
const ev = (s: string, rules = {}) => evalCards(h(s), rules);

describe('5-card ranking', () => {
  it('orders categories', () => {
    const order = [
      '2c 7d 9h Js Kd', // high
      '2c 2d 9h Js Kd', // pair
      '2c 2d 9h 9s Kd', // two pair
      '2c 2d 2h 9s Kd', // trips
      '5c 6d 7h 8s 9d', // straight
      '2h 7h 9h Jh Kh', // flush
      '2c 2d 2h 9s 9d', // full house
      '2c 2d 2h 2s 9d', // quads
      '5h 6h 7h 8h 9h', // straight flush
    ];
    const scores = order.map((x) => ev(x).score);
    expect(scores).toEqual([...scores].sort((a, b) => a - b));
  });

  it('wheel is the lowest straight', () => {
    expect(ev('Ah 2c 3d 4s 5h').name).toBe('Straight, Five high');
    expect(ev('Ah 2c 3d 4s 5h').score).toBeLessThan(ev('2c 3d 4s 5h 6d').score);
  });

  it('kickers break ties', () => {
    expect(ev('Kc Kd Ah 7s 2d').score).toBeGreaterThan(ev('Kh Ks Qh 7c 2c').score);
  });

  it('names hands', () => {
    expect(ev('Kh Kc Ks 7h 7d').name).toBe('Full house, Kings over Sevens');
    expect(ev('Ah Kh Qh Jh Th').name).toBe('Royal flush');
  });

  it('short deck: flush beats full house, A-6-7-8-9 straight', () => {
    const r = { shortDeck: true };
    expect(ev('6h 8h 9h Jh Kh', r).score).toBeGreaterThan(ev('Ac Ad Ah Ks Kd', r).score);
    expect(ev('Ah 6c 7d 8s 9h', r).kind).toBe('straight');
  });
});

describe('Omaha uses exactly two hole cards', () => {
  it('four hearts in hand with one on board is not a flush', () => {
    const hand = bestHigh(h('Ah Kh Qh Jh'), h('2h 7c 8d 9s 3c'), 'omaha');
    expect(hand.kind).not.toBe('flush');
  });

  it("board quads don't play for Omaha", () => {
    const hand = bestHigh(h('2c 3d 4h 6s'), h('Kc Kd Kh Ks 9c'), 'omaha');
    expect(hand.kind).toBe('trips');
  });

  it("Hold'em can play the board", () => {
    const hand = bestHigh(h('2c 3d'), h('Kc Kd Kh Ks 9c'), 'any');
    expect(hand.kind).toBe('quads');
  });
});

describe('8-or-better low', () => {
  it('finds the best low with exactly 2 hole cards', () => {
    const low = bestLow(h('Ah 2d Kc Ks'), h('3c 5d 8h Jc Qd'), 'omaha');
    expect(low?.name).toBe('Low 8-5-3-2-A');
  });

  it('no low when fewer than three low board cards', () => {
    expect(bestLow(h('Ah 2d 3c 4s'), h('9c Td 8h Jc Qd'), 'omaha')).toBeNull();
  });

  it('pairs do not count', () => {
    const low = bestLow(h('Ah Ad 3c 3s'), h('2c 4d 7h Jc Qd'), 'omaha');
    expect(low?.name).toBe('Low 7-4-3-2-A');
  });
});
