import { Card, makeDeck, Rng, shuffle } from './cards';
import { bestHigh, bestLow, HighHand, LowHand } from './evaluator';
import { Betting, Street, Variant, variantById } from './variants';

export interface TableConfig {
  variantId: string;
  betting: Betting;
  sb: number;
  bb: number;
  ante: number;
  maxSeats: number;
  minBuyIn: number;
  maxBuyIn: number;
  turnSeconds: number;
}

export interface SeatState {
  playerId: string;
  name: string;
  avatar: string;
  isBot: boolean;
  personaId?: string;
  stack: number;
  startStack: number;
  hole: Card[];
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  bet: number; // chips in front of the seat this betting round
  committed: number; // chips put in this hand, all rounds
  acted: boolean;
  lastAction: string | null;
  sittingOut: boolean;
  shown: boolean;
  needsDiscard: boolean;
  discarded: Card[];
}

export type Phase = 'idle' | 'betting' | 'discard' | 'runout' | 'handover';

export interface Legal {
  toCall: number;
  canCheck: boolean;
  canRaise: boolean;
  minTo: number;
  maxTo: number;
  isBet: boolean; // no bet yet this round, so a raise is labelled "Bet"
  potSize: number;
  raisesLeft: number | null; // Fixed-Limit only
}

export type ActionType = 'fold' | 'check' | 'call' | 'raise';
export interface Action { type: ActionType; amount?: number }

export interface Award {
  seat: number;
  amount: number;
  side: 'all' | 'high' | 'low' | 'board1' | 'board2' | 'uncalled';
  handName?: string;
  cards?: Card[];
}
export interface PotResult { label: string; amount: number; awards: Award[] }
export interface HandResult {
  uncontested: boolean;
  pots: PotResult[];
  totals: Record<number, number>; // seat -> chips won
  hands: Record<number, { high?: string; low?: string | null; board2?: string }>;
  headline: string;
}

export interface Pot { amount: number; eligible: number[] }

export type EngineEvent =
  | { type: 'handStart'; handNo: number }
  | { type: 'action'; seat: number; action: ActionType; text: string; amount: number }
  | { type: 'street'; street: Street | 'showdown' }
  | { type: 'discard'; seat: number }
  | { type: 'handEnd'; result: HandResult };

const STREETS: (Street | 'showdown')[] = ['preflop', 'flop', 'turn', 'river', 'showdown'];

export class PokerEngine {
  variant: Variant;
  seats: (SeatState | null)[];
  button = -1;
  sbSeat = -1;
  bbSeat = -1;
  handNo = 0;
  phase: Phase = 'idle';
  street: Street | 'showdown' = 'preflop';
  boards: Card[][] = [[]];
  deck: Card[] = [];
  currentBet = 0;
  minRaise = 0;
  raises = 0;
  toAct = -1;
  result: HandResult | null = null;
  log: string[] = [];
  events: EngineEvent[] = [];
  private discardDone = false;

  constructor(public config: TableConfig, private rng: Rng = Math.random) {
    this.variant = variantById(config.variantId);
    this.seats = Array(config.maxSeats).fill(null);
  }

  // ---------- seating ----------

  sit(index: number, p: Pick<SeatState, 'playerId' | 'name' | 'avatar' | 'isBot' | 'personaId'>, stack: number) {
    if (this.seats[index]) throw new Error('Seat taken');
    this.seats[index] = {
      ...p, stack, startStack: stack, hole: [], inHand: false, folded: false, allIn: false, bet: 0, committed: 0,
      acted: false, lastAction: null, sittingOut: false, shown: false, needsDiscard: false, discarded: [],
    };
  }

  /** Removes a player. Mid-hand they are folded first and their seat freed after the hand. */
  stand(index: number): number {
    const s = this.seats[index];
    if (!s) return 0;
    if (s.inHand && this.phase !== 'handover' && this.phase !== 'idle') {
      if (!s.folded) this.forceFold(index);
    }
    const chips = s.stack;
    this.seats[index] = null;
    return chips;
  }

  private forceFold(index: number) {
    const s = this.seats[index]!;
    if (this.phase === 'betting' && this.toAct === index) { this.act(index, { type: 'fold' }); return; }
    s.folded = true;
    s.needsDiscard = false;
    s.lastAction = 'Fold';
    this.events.push({ type: 'action', seat: index, action: 'fold', text: 'Fold', amount: 0 });
    if (this.livePlayers().length === 1) this.awardUncontested();
    else if (this.phase === 'discard' && !this.seats.some((x) => x?.needsDiscard)) this.afterDiscard();
    else if (this.phase === 'betting' && this.roundComplete()) this.endRound();
  }

  // ---------- helpers ----------

  private next(from: number, pred: (s: SeatState, i: number) => boolean): number {
    const n = this.seats.length;
    for (let k = 1; k <= n; k++) {
      const i = (from + k + n) % n;
      const s = this.seats[i];
      if (s && pred(s, i)) return i;
    }
    return -1;
  }

  private livePlayers() {
    return this.seats.map((s, i) => [s, i] as const).filter(([s]) => s && s.inHand && !s.folded).map(([, i]) => i);
  }

  private actionable(s: SeatState) { return s.inHand && !s.folded && !s.allIn; }

  private actionableCount() { return this.seats.filter((s) => s && this.actionable(s)).length; }

  private needsAction(s: SeatState) {
    if (!this.actionable(s)) return false;
    if (s.bet < this.currentBet) return true;
    if (s.acted) return false;
    // Lone player with chips behind everyone all-in has nothing to decide
    return this.actionableCount() > 1;
  }

  private roundComplete() { return !this.seats.some((s) => s && this.needsAction(s)); }

  get potTotal() { return this.seats.reduce((t, s) => t + (s?.committed ?? 0), 0); }

  private betUnit() {
    return this.street === 'turn' || this.street === 'river' ? this.config.bb * 2 : this.config.bb;
  }

  private put(s: SeatState, amount: number) {
    const a = Math.min(amount, s.stack);
    s.stack -= a;
    s.bet += a;
    s.committed += a;
    if (s.stack === 0) s.allIn = true;
    return a;
  }

  canStart() {
    return this.seats.filter((s) => s && !s.sittingOut && s.stack > 0).length >= 2;
  }

  // ---------- hand flow ----------

  startHand(): boolean {
    if (!this.canStart()) return false;
    this.variant = variantById(this.config.variantId);
    this.handNo++;
    this.result = null;
    this.log = [];
    this.discardDone = false;
    for (const s of this.seats) {
      if (!s) continue;
      Object.assign(s, {
        hole: [], inHand: !s.sittingOut && s.stack > 0, folded: false, allIn: false, bet: 0, committed: 0,
        acted: false, lastAction: null, shown: false, needsDiscard: false, discarded: [], startStack: s.stack,
      });
    }
    const inHand = (s: SeatState) => s.inHand;
    this.button = this.next(this.button, inHand);
    this.deck = shuffle(makeDeck(this.variant.deck), this.rng);
    this.boards = Array.from({ length: this.variant.boards }, () => []);

    for (let c = 0; c < this.variant.holeCards; c++) {
      let i = this.button;
      do {
        i = this.next(i, inHand);
        this.seats[i]!.hole.push(this.deck.pop()!);
      } while (i !== this.button);
    }
    if (this.variant.courchevel) this.boards[0].push(this.deck.pop()!);

    const players = this.seats.filter((s) => s?.inHand).length;
    this.sbSeat = players === 2 ? this.button : this.next(this.button, inHand);
    this.bbSeat = this.next(this.sbSeat, inHand);
    this.events.push({ type: 'handStart', handNo: this.handNo });
    this.log.push(`Hand #${this.handNo} · ${this.variant.name} · ${this.config.sb}/${this.config.bb}`);

    if (this.config.ante > 0) {
      for (const s of this.seats) if (s?.inHand) { this.put(s, this.config.ante); s.bet = 0; }
    }
    const sb = this.seats[this.sbSeat]!, bb = this.seats[this.bbSeat]!;
    this.put(sb, this.config.sb);
    this.put(bb, this.config.bb);
    this.log.push(`${sb.name} posts ${this.config.sb}, ${bb.name} posts ${this.config.bb}`);

    this.street = 'preflop';
    this.currentBet = this.config.bb;
    this.minRaise = this.config.bb;
    this.raises = 1;
    this.phase = 'betting';
    this.toAct = this.next(this.bbSeat, (s) => this.needsAction(s));
    if (this.toAct === -1) this.endRound();
    return true;
  }

  legal(index: number): Legal | null {
    const s = this.seats[index];
    if (!s || this.phase !== 'betting' || this.toAct !== index) return null;
    const fl = this.config.betting === 'FL';
    const toCall = Math.min(this.currentBet - s.bet, s.stack);
    const allInTo = s.bet + s.stack;
    let minTo = this.currentBet === 0 ? (fl ? this.betUnit() : this.config.bb) : this.currentBet + (fl ? this.betUnit() : this.minRaise);
    let maxTo: number;
    if (fl) maxTo = minTo;
    else if (this.config.betting === 'PL') maxTo = this.currentBet + this.potTotal + (this.currentBet - s.bet);
    else maxTo = allInTo;
    maxTo = Math.min(maxTo, allInTo);
    if (allInTo < minTo) minTo = maxTo = allInTo;
    const othersCanAct = this.seats.some((o, i) => o && i !== index && this.actionable(o));
    const capped = fl && this.raises >= 4;
    return {
      toCall,
      canCheck: this.currentBet === s.bet,
      canRaise: allInTo > this.currentBet && othersCanAct && !capped,
      minTo, maxTo,
      isBet: this.currentBet === 0,
      potSize: this.potTotal,
      raisesLeft: fl ? Math.max(0, 4 - this.raises) : null,
    };
  }

  act(index: number, action: Action): boolean {
    const legal = this.legal(index);
    if (!legal) return false;
    const s = this.seats[index]!;
    let text = '';
    let amount = 0;
    switch (action.type) {
      case 'fold':
        s.folded = true;
        text = 'Fold';
        break;
      case 'check':
        if (!legal.canCheck) return false;
        text = 'Check';
        break;
      case 'call':
        if (legal.canCheck) { text = 'Check'; action = { type: 'check' }; break; }
        amount = this.put(s, legal.toCall);
        text = s.allIn ? 'All-in' : `Call ${amount.toLocaleString()}`;
        break;
      case 'raise': {
        if (!legal.canRaise) return false;
        const to = Math.max(legal.minTo, Math.min(legal.maxTo, Math.round(action.amount ?? legal.minTo)));
        const wasBet = this.currentBet === 0;
        amount = this.put(s, to - s.bet);
        const size = s.bet - this.currentBet;
        if (size >= this.minRaise || this.config.betting === 'FL') {
          this.minRaise = Math.max(size, this.minRaise);
          this.raises++;
          for (const o of this.seats) if (o && o !== s) o.acted = false;
        }
        this.currentBet = Math.max(this.currentBet, s.bet);
        text = s.allIn ? 'All-in' : wasBet ? `Bet ${s.bet.toLocaleString()}` : `Raise to ${s.bet.toLocaleString()}`;
        break;
      }
    }
    s.acted = true;
    s.lastAction = text;
    this.log.push(`${s.name}: ${text}`);
    this.events.push({ type: 'action', seat: index, action: action.type, text, amount });
    this.afterAction(index);
    return true;
  }

  private afterAction(from: number) {
    if (this.livePlayers().length === 1) return this.awardUncontested();
    if (this.roundComplete()) return this.endRound();
    this.toAct = this.next(from, (s) => this.needsAction(s));
  }

  private endRound() {
    for (const s of this.seats) if (s) { s.bet = 0; s.acted = false; }
    this.currentBet = 0;
    this.minRaise = this.config.bb;
    this.raises = 0;
    this.toAct = -1;
    const d = this.variant.discard;
    if (d && !this.discardDone && d.after === this.street) {
      this.phase = 'discard';
      for (const s of this.seats) if (s?.inHand && !s.folded) s.needsDiscard = true;
      return;
    }
    this.nextStreet();
  }

  discard(index: number, cards: Card[]): boolean {
    const s = this.seats[index];
    const need = this.variant.discard?.count ?? 0;
    if (!s || this.phase !== 'discard' || !s.needsDiscard) return false;
    if (cards.length !== need || new Set(cards).size !== need || !cards.every((c) => s.hole.includes(c))) return false;
    s.hole = s.hole.filter((c) => !cards.includes(c));
    s.discarded = cards;
    s.needsDiscard = false;
    this.log.push(`${s.name} discards ${need}`);
    this.events.push({ type: 'discard', seat: index });
    if (!this.seats.some((x) => x?.needsDiscard)) this.afterDiscard();
    return true;
  }

  private afterDiscard() {
    this.discardDone = true;
    this.nextStreet();
  }

  private nextStreet() {
    const nextSt = STREETS[STREETS.indexOf(this.street) + 1];
    this.street = nextSt;
    for (const s of this.seats) if (s && s.lastAction && s.lastAction !== 'Fold' && s.lastAction !== 'All-in') s.lastAction = null;
    if (nextSt === 'showdown') return this.showdown();
    const target = nextSt === 'flop' ? 3 : nextSt === 'turn' ? 4 : 5;
    for (const b of this.boards) while (b.length < target) b.push(this.deck.pop()!);
    this.log.push(`${nextSt[0].toUpperCase() + nextSt.slice(1)}: ${this.boards.map((b) => b.join(' ')).join(' | ')}`);
    this.events.push({ type: 'street', street: nextSt });
    this.phase = 'betting';
    this.toAct = this.next(this.button, (s) => this.needsAction(s));
    // Nobody left to bet (all-in): deal the rest out with a pause between streets
    if (this.toAct === -1) this.phase = 'runout';
  }

  /** Called by the server after a short pause while running out an all-in board. */
  continueRunout() {
    if (this.phase === 'runout') this.endRound();
  }

  /** Pots from chips committed so far. `excludeBets` leaves out the current round's bets (for display). */
  pots(excludeBets = false): Pot[] {
    const contrib = this.seats.map((s, i) => ({ i, c: s ? s.committed - (excludeBets ? s.bet : 0) : 0, live: !!s && s.inHand && !s.folded }));
    const levels = [...new Set(contrib.filter((x) => x.live && x.c > 0).map((x) => x.c))].sort((a, b) => a - b);
    const pots: Pot[] = [];
    let prev = 0;
    for (const L of levels) {
      const amount = contrib.reduce((t, x) => t + Math.max(0, Math.min(x.c, L) - Math.min(x.c, prev)), 0);
      pots.push({ amount, eligible: contrib.filter((x) => x.live && x.c >= L).map((x) => x.i) });
      prev = L;
    }
    const dead = contrib.reduce((t, x) => t + Math.max(0, x.c - prev), 0);
    if (dead > 0) {
      if (pots.length) pots[pots.length - 1].amount += dead;
      else pots.push({ amount: dead, eligible: [] });
    }
    return pots.filter((p) => p.amount > 0);
  }

  private awardUncontested() {
    const winner = this.livePlayers()[0];
    const total = this.potTotal;
    const s = this.seats[winner]!;
    s.stack += total;
    for (const x of this.seats) if (x) x.bet = 0;
    this.finish({
      uncontested: true,
      pots: [{ label: 'Pot', amount: total, awards: [{ seat: winner, amount: total, side: 'all' }] }],
      totals: { [winner]: total },
      hands: {},
      headline: `${s.name} wins ${total.toLocaleString()}`,
    });
  }

  /** Splits `amount` between `winners`; odd chips go to the first winners left of the button. */
  private split(amount: number, winners: number[]): number[] {
    const n = this.seats.length;
    const each = Math.floor(amount / winners.length);
    let rem = amount - each * winners.length;
    const out = winners.map(() => each);
    const order = winners.map((w, j) => ({ j, d: (w - this.button - 1 + n) % n })).sort((a, b) => a.d - b.d);
    for (const o of order) { if (rem <= 0) break; out[o.j]++; rem--; }
    return out;
  }

  private showdown() {
    const v = this.variant;
    const live = this.livePlayers();
    const highs = new Map<number, HighHand[]>();
    const lows = new Map<number, LowHand | null>();
    for (const i of live) {
      const s = this.seats[i]!;
      s.shown = true;
      highs.set(i, this.boards.map((b) => bestHigh(s.hole, b, v.mode, v.rules)));
      if (v.hiLo) lows.set(i, bestLow(s.hole, this.boards[0], v.mode));
    }
    const hands: HandResult['hands'] = {};
    for (const i of live) {
      hands[i] = { high: highs.get(i)![0].name, low: v.hiLo ? lows.get(i)?.name ?? null : undefined, board2: highs.get(i)![1]?.name };
    }

    const bestOf = (cands: number[], score: (i: number) => number | null, lowWins = false) => {
      let best: number | null = null;
      let ws: number[] = [];
      for (const i of cands) {
        const sc = score(i);
        if (sc === null) continue;
        if (best === null || (lowWins ? sc < best : sc > best)) { best = sc; ws = [i]; }
        else if (sc === best) ws.push(i);
      }
      return ws;
    };

    const pots = this.pots();
    const results: PotResult[] = [];
    const totals: Record<number, number> = {};
    const give = (seat: number, amount: number, side: Award['side'], awards: Award[], hand?: { name: string; cards: Card[] }) => {
      this.seats[seat]!.stack += amount;
      totals[seat] = (totals[seat] ?? 0) + amount;
      awards.push({ seat, amount, side, handName: hand?.name, cards: hand?.cards });
    };

    pots.forEach((pot, k) => {
      const awards: Award[] = [];
      const label = pots.length === 1 ? 'Pot' : k === 0 ? 'Main pot' : `Side pot ${k}`;
      if (pot.eligible.length === 1) {
        give(pot.eligible[0], pot.amount, 'uncalled', awards);
        results.push({ label: 'Returned', amount: pot.amount, awards });
        return;
      }
      const highWinners = (b: number) => bestOf(pot.eligible, (i) => highs.get(i)![b].score);
      const payHigh = (amount: number, b: number, side: Award['side']) => {
        const ws = highWinners(b);
        this.split(amount, ws).forEach((amt, j) => give(ws[j], amt, side, awards, highs.get(ws[j])![b]));
      };
      if (v.boards === 2) {
        const half = Math.floor(pot.amount / 2);
        payHigh(pot.amount - half, 0, 'board1');
        payHigh(half, 1, 'board2');
      } else if (v.hiLo) {
        const lowWs = bestOf(pot.eligible, (i) => lows.get(i)?.score ?? null, true);
        if (lowWs.length) {
          const half = Math.floor(pot.amount / 2);
          payHigh(pot.amount - half, 0, 'high');
          this.split(half, lowWs).forEach((amt, j) => give(lowWs[j], amt, 'low', awards, lows.get(lowWs[j])!));
        } else payHigh(pot.amount, 0, 'all');
      } else payHigh(pot.amount, 0, 'all');
      results.push({ label, amount: pot.amount, awards });
    });

    this.finish({ uncontested: false, pots: results, totals, hands, headline: this.headline(results) });
  }

  private headline(pots: PotResult[]): string {
    const main = pots.find((p) => p.label !== 'Returned') ?? pots[0];
    const name = (i: number) => this.seats[i]!.name;
    const bySide = (side: Award['side']) => [...new Set(main.awards.filter((a) => a.side === side).map((a) => name(a.seat)))].join(' & ');
    if (main.awards.some((a) => a.side === 'low')) return `Split pot · High to ${bySide('high')}, Low to ${bySide('low')}`;
    if (main.awards.some((a) => a.side === 'board2')) return `Board 1 to ${bySide('board1')}, Board 2 to ${bySide('board2')}`;
    const ws = [...new Set(main.awards.map((a) => a.seat))];
    if (ws.length > 1) return `Split pot · ${ws.map(name).join(' & ')} chop ${main.amount.toLocaleString()}`;
    // A single winner's headline counts every pot they took, not just the main one
    const won = pots.flatMap((p) => p.awards).filter((a) => a.seat === ws[0] && a.side !== 'uncalled').reduce((t, a) => t + a.amount, 0);
    return `${name(ws[0])} wins ${won.toLocaleString()} · ${main.awards[0].handName}`;
  }

  private finish(result: HandResult) {
    this.result = result;
    this.phase = 'handover';
    this.toAct = -1;
    for (const p of result.pots) for (const a of p.awards) {
      if (a.side !== 'uncalled') this.log.push(`${this.seats[a.seat]!.name} wins ${a.amount.toLocaleString()}${a.handName ? ` (${a.handName})` : ''}`);
    }
    this.events.push({ type: 'handEnd', result });
  }

  /** Voluntary show after the hand (e.g. a folded bluff). */
  show(index: number) {
    const s = this.seats[index];
    if (s && s.inHand && this.phase === 'handover') s.shown = true;
  }

  drainEvents(): EngineEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}
