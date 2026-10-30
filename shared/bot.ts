import { Card, combinations, makeDeck, rankOf, suitOf } from './cards';
import { Action, Legal, PokerEngine } from './engine';
import { bestHigh, bestLow, evalCards } from './evaluator';
import { Persona } from './personas';
import { Variant } from './variants';

/**
 * Monte Carlo share of the pot this hand wins against `opponents` random hands.
 * Hi-Lo counts half for high and half for low; Double-Board half per board.
 */
export function estimateEquity(v: Variant, hole: Card[], boards: Card[][], opponents: number, iterations: number, rng = Math.random): number {
  const known = new Set([...hole, ...boards.flat()]);
  const deck = makeDeck(v.deck).filter((c) => !known.has(c));
  // Opponents in draw games keep the post-discard hand size
  const oppCards = Math.min(hole.length, v.holeCards);
  let share = 0;
  for (let it = 0; it < iterations; it++) {
    const d = deck.slice();
    const draw = () => d.splice(Math.floor(rng() * d.length), 1)[0];
    const opps = Array.from({ length: opponents }, () => Array.from({ length: oppCards }, draw));
    const full = boards.map((b) => { const nb = b.slice(); while (nb.length < 5) nb.push(draw()); return nb; });
    const parts: number[] = [];
    for (const b of full) {
      const me = bestHigh(hole, b, v.mode, v.rules).score;
      let best = me, ties = 1;
      for (const o of opps) {
        const sc = bestHigh(o, b, v.mode, v.rules).score;
        if (sc > best) { best = sc; ties = 0; } else if (sc === best) ties++;
      }
      parts.push(best === me ? 1 / ties : 0);
    }
    if (v.hiLo) {
      const me = bestLow(hole, full[0], v.mode)?.score ?? Infinity;
      let best = me, ties = 1;
      for (const o of opps) {
        const sc = bestLow(o, full[0], v.mode)?.score ?? Infinity;
        if (sc < best) { best = sc; ties = 0; } else if (sc === best) ties++;
      }
      // No qualifying low anywhere: high takes the whole pot
      share += best === Infinity ? parts[0] : (parts[0] + (best === me ? 1 / ties : 0)) / 2;
    } else share += parts.reduce((a, b) => a + b, 0) / parts.length;
  }
  return share / iterations;
}

/** Keeps one decision to roughly 30k hand evaluations (~20 ms) whatever the variant. */
function iterationsFor(v: Variant, holeSize: number, opponents: number): number {
  const combos = v.mode === 'omaha' ? (holeSize * (holeSize - 1)) / 2 * 10 : binom(holeSize + 5, 5);
  const perIteration = combos * (Math.max(1, opponents) + 1) * v.boards * (v.hiLo ? 1.6 : 1);
  return clamp(Math.floor(30000 / perIteration), 24, 250);
}

const binom = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

export interface BotMemory { tilt: number } // 0..1, rises after big losses

/** Picks an action for a bot seat from its persona traits and a quick equity estimate. */
export function decide(engine: PokerEngine, seat: number, persona: Persona, mem: BotMemory, rng = Math.random): Action {
  const legal = engine.legal(seat)!;
  const s = engine.seats[seat]!;
  const v = engine.variant;
  const t = persona.traits;
  const opponents = engine.seats.filter((o, i) => o && i !== seat && o.inHand && !o.folded).length;
  const eq = estimateEquity(v, s.hole, engine.boards, Math.max(1, opponents), iterationsFor(v, s.hole.length, opponents), rng);
  const fair = 1 / (opponents + 1);

  // Relative strength: 1.0 = an average hand in this pot
  let strength = eq / fair;
  strength += ((t.looseness - 50) / 100) * 0.6;
  strength += mem.tilt * (t.tilt / 100) * 0.5;
  const latePosition = seatsBehind(engine, seat) <= 1;
  if (latePosition) strength += (t.position / 100) * 0.2;
  const noise = (rng() - 0.5) * (1 - t.discipline / 100) * 0.5;
  strength += noise;

  const aggr = t.aggression / 100;
  const pot = legal.potSize;
  const raiseTo = (fraction: number) => {
    const base = legal.isBet ? 0 : engine.currentBet;
    const want = base + Math.max(legal.toCall, 0) + fraction * (pot + legal.toCall);
    return clamp(Math.round(want / engine.config.sb) * engine.config.sb, legal.minTo, legal.maxTo);
  };
  const sizeFraction = 0.45 + aggr * 0.55 + (persona.archetype === 'maniac' ? 0.6 : 0) + (persona.archetype === 'nit' ? -0.2 : 0);
  const raise = (): Action => {
    // Short stack with a strong hand: just get it in
    if (s.stack < pot * 0.8 && strength > 1.4) return { type: 'raise', amount: legal.maxTo };
    return { type: 'raise', amount: raiseTo(sizeFraction * (0.8 + rng() * 0.4)) };
  };

  if (legal.toCall <= 0) {
    // Unopened: value bet, bluff, or check
    if (legal.canRaise && strength > 1.35 - aggr * 0.3 && rng() < 0.35 + aggr * 0.6) return raise();
    if (legal.canRaise && rng() < (t.bluffing / 100) * 0.25 * (opponents <= 2 ? 1.4 : 0.7)) return raise();
    return { type: 'check' };
  }

  const potOdds = legal.toCall / (pot + legal.toCall);
  const callBias = (1 - t.discipline / 100) * 0.25 + (persona.archetype === 'station' ? 0.2 : 0);
  if (legal.canRaise && strength > 1.75 - aggr * 0.45 && rng() < 0.3 + aggr * 0.55) return raise();
  if (legal.canRaise && rng() < (t.bluffing / 100) * 0.08) return raise();
  if (eq + callBias * fair >= potOdds * 1.05 || strength > 1.15) return { type: 'call' };
  // Cheap price with any reason to continue
  if (potOdds < 0.12 && rng() < t.looseness / 100) return { type: 'call' };
  return { type: 'fold' };
}

function seatsBehind(e: PokerEngine, seat: number): number {
  // Players still to act after this seat on this street, rough position measure
  const n = e.seats.length;
  let count = 0;
  for (let k = 1; k < n; k++) {
    const i = (seat + k) % n;
    if (i === (e.button + 1) % n) break;
    const s = e.seats[i];
    if (s && s.inHand && !s.folded && !s.allIn) count++;
  }
  return count;
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Cards a bot throws away in Pineapple, Crazy Pineapple and Irish. */
export function chooseDiscard(hole: Card[], board: Card[], count: number, rules = {}): Card[] {
  const keep = hole.length - count;
  let bestKeep = hole.slice(0, keep);
  let best = -Infinity;
  for (const k of combinations(hole, keep)) {
    let score: number;
    if (board.length >= 3) score = combinations(k.concat(board), 5).reduce((m, five) => Math.max(m, evalCards(five, rules).score), 0);
    else {
      const [a, b] = k.map(rankOf).sort((x, y) => y - x);
      score = (a === b ? 100 + a * 4 : a + b) + (suitOf(k[0]) === suitOf(k[1]) ? 4 : 0) + (Math.abs(a - b) === 1 ? 3 : 0);
    }
    if (score > best) { best = score; bestKeep = k; }
  }
  return hole.filter((c) => !bestKeep.includes(c));
}

/** How long a persona "thinks" before acting, in ms. */
export function thinkTime(p: Persona, bigDecision: boolean, rng = Math.random): number {
  const base = p.archetype === 'shark' ? 1400 : p.archetype === 'fish' ? (bigDecision ? 3000 : 700) : p.archetype === 'maniac' ? 600 : 1000;
  return Math.round(base * (0.6 + rng() * 0.8));
}
