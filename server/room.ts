import { BotMemory, chooseDiscard, decide, thinkTime } from '../shared/bot';
import { Card } from '../shared/cards';
import { Action, PokerEngine } from '../shared/engine';
import { ChatTrigger, chatLine, Persona, PERSONAS, personaById } from '../shared/personas';
import type { BotDifficulty, ChatMsg, CreateTableOpts, LobbyTable, PublicSeat, TableView } from '../shared/protocol';
import { variantById } from '../shared/variants';
import type { Players } from './players';

const HANDOVER_MS = 5200;
const RUNOUT_MS = 1300;
const BOT_DISCARD_MS = 900;

export class Room {
  engine: PokerEngine;
  hostId: string;
  name: string;
  isPrivate: boolean;
  fillBots: boolean;
  botDifficulty: BotDifficulty;
  started = false;
  paused = false;
  viewers = new Set<string>();
  emptySince: number | null = null;

  private joinOrder: string[] = [];
  private bots = new Map<number, { persona: Persona; mem: BotMemory }>();
  private autoRebuy = new Set<string>();
  private missed = new Map<string, number>();
  private chat: ChatMsg[] = [];
  private chatId = 0;
  private tick = 0;
  private timers: NodeJS.Timeout[] = [];
  private turnEndsAt = 0;
  private turnMs = 0;
  private potHistory: number[] = [];

  constructor(public id: string, public code: string, opts: CreateTableOpts, hostId: string, private players: Players, private onChange: () => void) {
    const v = variantById(opts.variantId);
    const maxSeats = Math.max(2, Math.min(v.maxSeats, opts.maxSeats));
    const bb = Math.max(2, Math.round(opts.bb));
    this.engine = new PokerEngine({
      variantId: v.id,
      betting: v.betting.includes(opts.betting) ? opts.betting : v.betting[0],
      sb: Math.max(1, Math.min(bb, Math.round(opts.sb))),
      bb,
      ante: Math.max(0, Math.round(opts.ante)),
      maxSeats,
      minBuyIn: Math.max(10, opts.minBuyInBB) * bb,
      maxBuyIn: Math.max(opts.minBuyInBB, opts.maxBuyInBB) * bb,
      turnSeconds: Math.max(10, Math.min(120, opts.turnSeconds)),
    });
    this.hostId = hostId;
    this.name = opts.name.trim().slice(0, 32) || 'Poker table';
    this.isPrivate = opts.isPrivate;
    this.fillBots = opts.fillBots;
    this.botDifficulty = opts.botDifficulty;
    this.started = opts.autoStart;
  }

  // ---------- membership ----------

  join(token: string) {
    const p = this.players.get(token)!;
    if (!this.viewers.has(token)) {
      this.viewers.add(token);
      this.joinOrder.push(token);
      this.system(`${p.name} joined`);
    }
    this.emptySince = null;
    this.players.send(token, { t: 'chat', msgs: this.chat, replace: true });
    this.refresh();
  }

  leave(token: string) {
    const p = this.players.get(token);
    if (this.seatOf(token) >= 0) this.stand(token);
    this.viewers.delete(token);
    this.joinOrder = this.joinOrder.filter((t) => t !== token);
    if (p) this.system(`${p.name} left`);
    if (token === this.hostId) {
      const next = this.joinOrder.find((t) => this.viewers.has(t));
      if (next) {
        this.hostId = next;
        this.system(`${this.players.get(next)!.name} is now the host`);
      }
    }
    if (this.humanCount() === 0) this.emptySince = Date.now();
    this.refresh();
  }

  humanCount() { return [...this.viewers].filter((t) => this.players.get(t)?.ws).length; }

  seatOf(token: string) { return this.engine.seats.findIndex((s) => s && !s.isBot && s.playerId === token); }

  // ---------- seat actions ----------

  sit(token: string, seat: number, buyIn: number, autoRebuy: boolean): string | null {
    const e = this.engine, p = this.players.get(token)!;
    if (this.seatOf(token) >= 0) return 'You are already seated';
    if (seat < 0 || seat >= e.seats.length || e.seats[seat]) return 'That seat is taken';
    buyIn = Math.round(buyIn);
    if (buyIn < e.config.minBuyIn || buyIn > e.config.maxBuyIn) return `Buy-in must be ${e.config.minBuyIn.toLocaleString()} to ${e.config.maxBuyIn.toLocaleString()}`;
    if (buyIn > p.balance) return 'Not enough chips. Top up from the lobby.';
    p.balance -= buyIn;
    this.players.save();
    this.players.send(token, { t: 'balance', balance: p.balance });
    e.sit(seat, { playerId: token, name: p.name, avatar: p.avatar, isBot: false }, buyIn);
    if (autoRebuy) this.autoRebuy.add(token); else this.autoRebuy.delete(token);
    this.missed.delete(token);
    this.refresh();
    return null;
  }

  stand(token: string) {
    const idx = this.seatOf(token);
    if (idx < 0) return;
    const p = this.players.get(token)!;
    const chips = this.engine.stand(idx);
    p.balance += chips;
    this.players.save();
    this.players.send(token, { t: 'balance', balance: p.balance });
    if (this.fillBots && this.started) this.addBot(idx);
    this.step();
  }

  addChips(token: string, amount: number): string | null {
    const idx = this.seatOf(token), e = this.engine;
    if (idx < 0) return 'Sit down first';
    const s = e.seats[idx]!, p = this.players.get(token)!;
    if (s.inHand && e.phase !== 'handover' && e.phase !== 'idle') return 'You can add chips between hands';
    amount = Math.min(Math.round(amount), e.config.maxBuyIn - s.stack, p.balance);
    if (amount <= 0) return 'Already at the maximum buy-in';
    p.balance -= amount;
    s.stack += amount;
    if (s.sittingOut && s.stack > 0) s.sittingOut = false;
    this.players.save();
    this.players.send(token, { t: 'balance', balance: p.balance });
    this.refresh();
    if (this.engine.phase === 'idle') this.step();
    return null;
  }

  sitOut(token: string, value: boolean) {
    const idx = this.seatOf(token);
    if (idx < 0) return;
    const s = this.engine.seats[idx]!;
    if (!value && s.stack === 0) return;
    s.sittingOut = value;
    this.missed.delete(token);
    if (this.engine.phase === 'idle' || (this.engine.toAct === idx && value)) this.step();
    else this.refresh();
  }

  action(token: string, a: Action) {
    const idx = this.seatOf(token);
    if (idx < 0 || this.engine.toAct !== idx) return;
    if (this.engine.act(idx, a)) {
      this.missed.delete(token);
      this.step();
    }
  }

  discard(token: string, cards: Card[]) {
    const idx = this.seatOf(token);
    if (idx >= 0 && this.engine.discard(idx, cards)) this.step();
  }

  show(token: string) {
    const idx = this.seatOf(token);
    if (idx >= 0) { this.engine.show(idx); this.refresh(); }
  }

  say(token: string, text: string) {
    const p = this.players.get(token)!;
    text = text.trim().slice(0, 200);
    if (!text) return;
    this.pushChat({ kind: 'player', name: p.name, avatar: p.avatar, seat: this.seatOf(token), text });
  }

  emote(token: string, emote: string) {
    const p = this.players.get(token)!;
    this.pushChat({ kind: 'emote', name: p.name, avatar: p.avatar, seat: this.seatOf(token), text: emote.slice(0, 16) });
  }

  host(token: string, op: string, seat?: number, personaId?: string): string | null {
    if (token !== this.hostId) return 'Only the host can do that';
    const e = this.engine;
    switch (op) {
      case 'start':
        this.started = true;
        this.paused = false;
        this.system('Game started');
        break;
      case 'pause':
        this.paused = !this.paused;
        this.system(this.paused ? 'Game paused after this hand' : 'Game resumed');
        break;
      case 'addBot':
        if (seat === undefined || e.seats[seat]) return 'Pick an empty seat';
        this.addBot(seat, personaId);
        break;
      case 'removeBot':
        if (seat === undefined || !this.bots.has(seat)) return 'No bot in that seat';
        this.bots.delete(seat);
        e.stand(seat);
        break;
      case 'kick': {
        const s = seat !== undefined ? e.seats[seat] : null;
        if (!s || s.isBot) return 'No player in that seat';
        if (s.playerId === token) return 'You cannot kick yourself';
        const kicked = s.playerId;
        this.leave(kicked);
        this.players.send(kicked, { t: 'left' });
        this.players.send(kicked, { t: 'toast', text: 'The host removed you from the table', kind: 'error' });
        const pl = this.players.get(kicked);
        if (pl) pl.roomId = undefined;
        break;
      }
    }
    this.step();
    return null;
  }

  // ---------- bots ----------

  addBot(seat: number, personaId?: string) {
    const taken = new Set([...this.bots.values()].map((b) => b.persona.id));
    const persona = (personaId && !taken.has(personaId) && personaById(personaId)) || this.pickPersona(taken);
    this.bots.set(seat, { persona, mem: { tilt: 0 } });
    // Seat plates show first names; add a last initial when two bots share one
    const [first, ...rest] = persona.name.split(' ');
    const clash = this.engine.seats.some((s) => s?.name === first);
    const name = clash ? `${first} ${rest.join(' ')[0] ?? ''}.` : first;
    this.engine.sit(seat, { playerId: persona.id, name, avatar: persona.initials, isBot: true, personaId: persona.id }, this.engine.config.maxBuyIn);
    this.botSay(seat, 'greet');
  }

  pickPersona(taken: Set<string>): Persona {
    const d = this.botDifficulty;
    const pool = PERSONAS.filter((p) => !taken.has(p.id) && (d === 'Mixed' || p.difficulty === d));
    const list = pool.length ? pool : PERSONAS.filter((p) => !taken.has(p.id));
    return list[Math.floor(Math.random() * list.length)];
  }

  private botSay(seat: number, trigger: ChatTrigger) {
    const b = this.bots.get(seat);
    if (!b) return;
    const line = chatLine(b.persona, trigger);
    if (line) this.pushChat({ kind: 'bot', name: this.engine.seats[seat]?.name ?? b.persona.name, avatar: b.persona.initials, seat, text: line });
  }

  // ---------- the loop ----------

  private clearTimers() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  private later(ms: number, fn: () => void) {
    const tick = this.tick;
    this.timers.push(setTimeout(() => { if (tick === this.tick) fn(); }, ms));
  }

  /** Re-evaluates what happens next after any change, then broadcasts. */
  step() {
    this.processEvents();
    this.clearTimers();
    this.tick++;
    const e = this.engine;
    this.turnEndsAt = 0;
    this.turnMs = 0;

    if (e.phase === 'betting' && e.toAct >= 0) {
      const idx = e.toAct;
      const seat = e.seats[idx]!;
      const bot = this.bots.get(idx);
      if (bot) {
        const big = (e.legal(idx)?.toCall ?? 0) > e.potTotal * 0.5;
        const ms = thinkTime(bot.persona, big);
        this.turnMs = ms;
        this.turnEndsAt = Date.now() + ms;
        this.later(ms, () => {
          const a = decide(e, idx, bot.persona, bot.mem);
          if (!e.act(idx, a)) e.act(idx, { type: e.legal(idx)?.canCheck ? 'check' : 'fold' });
          this.step();
        });
      } else {
        const away = seat.sittingOut;
        const ms = away ? 700 : e.config.turnSeconds * 1000;
        this.turnMs = ms;
        this.turnEndsAt = Date.now() + ms;
        this.later(ms, () => {
          const l = e.legal(idx);
          if (!l) return this.step();
          e.act(idx, { type: l.canCheck ? 'check' : 'fold' });
          if (!away) {
            const n = (this.missed.get(seat.playerId) ?? 0) + 1;
            this.missed.set(seat.playerId, n);
            if (n >= 2) {
              seat.sittingOut = true;
              this.system(`${seat.name} is sitting out`);
            }
          }
          this.step();
        });
      }
    } else if (e.phase === 'discard') {
      const count = e.variant.discard!.count;
      const autoDiscard = (botsOnly: boolean) => {
        e.seats.forEach((s, i) => {
          if (s?.needsDiscard && (!botsOnly || s.isBot)) e.discard(i, chooseDiscard(s.hole, e.boards[0], count, e.variant.rules));
        });
        this.step();
      };
      if (e.seats.some((s) => s?.needsDiscard && s.isBot)) this.later(BOT_DISCARD_MS, () => autoDiscard(true));
      else {
        const ms = e.config.turnSeconds * 1000;
        this.turnMs = ms;
        this.turnEndsAt = Date.now() + ms;
        this.later(ms, () => autoDiscard(false));
      }
    } else if (e.phase === 'runout') {
      this.later(RUNOUT_MS, () => { e.continueRunout(); this.step(); });
    } else if (e.phase === 'handover') {
      this.later(HANDOVER_MS, () => this.nextHand());
    } else if (e.phase === 'idle' && this.started && !this.paused && e.canStart()) {
      this.later(1200, () => this.nextHand());
    }
    this.refresh();
  }

  private nextHand() {
    const e = this.engine;
    e.seats.forEach((s, i) => {
      if (!s || s.stack > 0) return;
      if (s.isBot) {
        s.stack = e.config.maxBuyIn;
        this.botSay(i, 'greet');
        return;
      }
      const p = this.players.get(s.playerId);
      if (p && this.autoRebuy.has(s.playerId) && p.balance >= e.config.minBuyIn) {
        const amt = Math.min(e.config.maxBuyIn, p.balance);
        p.balance -= amt;
        s.stack = amt;
        this.players.save();
        this.players.send(s.playerId, { t: 'balance', balance: p.balance });
        this.system(`${s.name} rebuys for ${amt.toLocaleString()}`);
      } else {
        s.sittingOut = true;
        this.players.send(s.playerId, { t: 'toast', text: 'Out of chips. Add chips to keep playing.' });
      }
    });
    if (!this.started || this.paused || !e.canStart()) e.phase = 'idle';
    else e.startHand();
    this.step();
  }

  private processEvents() {
    const e = this.engine;
    for (const ev of e.drainEvents()) {
      if (ev.type === 'action') {
        if (!this.bots.has(ev.seat)) continue;
        if (ev.text === 'All-in') this.botSay(ev.seat, 'allIn');
        else if (ev.action === 'raise') this.botSay(ev.seat, 'raise');
        else if (ev.action === 'fold') this.botSay(ev.seat, 'fold');
      } else if (ev.type === 'handEnd') {
        const r = ev.result;
        const total = r.pots.reduce((t, p) => t + p.amount, 0);
        this.potHistory = [...this.potHistory.slice(-19), total];
        this.system(r.headline);
        const v = e.variant;
        e.seats.forEach((s, i) => {
          if (!s || !s.inHand) return;
          const net = s.stack - s.startStack;
          const bot = this.bots.get(i);
          if (bot) {
            if (net < -s.startStack * 0.3) { bot.mem.tilt = Math.min(1, bot.mem.tilt + 0.5); this.botSay(i, 'bigLoss'); }
            else bot.mem.tilt *= 0.7;
            if (net > e.config.bb * 15) this.botSay(i, r.uncontested ? 'bluffWin' : 'bigWin');
            return;
          }
          const p = this.players.get(s.playerId);
          if (!p) return;
          p.history = [{
            id: `${this.id}-${e.handNo}`, ts: Date.now(), tableName: this.name, game: v.tag,
            stakes: `${e.config.sb}/${e.config.bb}`, hole: s.hole.concat(s.discarded), boards: e.boards.map((b) => b.slice()),
            net, headline: r.headline, log: e.log.slice(),
          }, ...p.history].slice(0, 100);
          this.players.save();
        });
      }
    }
  }

  // ---------- chat ----------

  private system(text: string) { this.pushChat({ kind: 'system', name: '', text }); }

  private pushChat(m: Omit<ChatMsg, 'id' | 'ts'>) {
    const msg: ChatMsg = { ...m, id: ++this.chatId, ts: Date.now() };
    this.chat = [...this.chat.slice(-99), msg];
    for (const t of this.viewers) this.players.send(t, { t: 'chat', msgs: [msg] });
  }

  // ---------- views ----------

  refresh() {
    for (const t of this.viewers) this.players.send(t, { t: 'table', view: this.view(t) });
    this.onChange();
  }

  view(token: string): TableView {
    const e = this.engine;
    const mySeat = this.seatOf(token);
    const used = new Map<number, Set<Card>>();
    if (e.phase === 'handover' && e.result) {
      for (const p of e.result.pots) for (const a of p.awards) {
        if (!a.cards) continue;
        if (!used.has(a.seat)) used.set(a.seat, new Set());
        a.cards.forEach((c) => used.get(a.seat)!.add(c));
      }
    }
    const showAll = e.phase === 'runout';
    const seats = e.seats.map((s, i): PublicSeat | null => {
      if (!s) return null;
      const visible = s.playerId === token || ((s.shown || (showAll && !s.folded)) && s.inHand);
      return {
        index: i, playerId: s.isBot ? s.playerId : s.playerId === token ? token : `h${i}`,
        name: s.name, avatar: s.avatar, isBot: s.isBot, personaId: s.personaId,
        stack: s.stack, bet: s.bet, inHand: s.inHand, folded: s.folded, allIn: s.allIn, lastAction: s.lastAction,
        sittingOut: s.sittingOut, connected: s.isBot || !!(this.players.get(s.playerId)?.ws && this.viewers.has(s.playerId)),
        hole: visible && s.hole.length ? s.hole : null, cardCount: s.hole.length, shown: s.shown,
        needsDiscard: s.needsDiscard, usedCards: [...(used.get(i) ?? [])],
      };
    });
    return {
      id: this.id, code: this.code, name: this.name,
      hostId: this.hostId === token ? token : 'other',
      config: e.config, isPrivate: this.isPrivate, started: this.started, paused: this.paused,
      handNo: e.handNo, phase: e.phase, street: e.street, boards: e.boards,
      pots: e.pots(true).map((p, k, all) => ({ label: all.length === 1 ? 'Pot' : k === 0 ? 'Main pot' : `Side pot ${k}`, amount: p.amount })),
      potTotal: e.potTotal, currentBet: e.currentBet, toAct: e.toAct,
      turnLeftMs: this.turnEndsAt ? Math.max(0, this.turnEndsAt - Date.now()) : 0, turnEndsAt: 0, turnMs: this.turnMs,
      button: e.button, sbSeat: e.sbSeat, bbSeat: e.bbSeat,
      seats, mySeat, legal: mySeat >= 0 ? e.legal(mySeat) : null,
      result: e.phase === 'handover' ? e.result : null,
      spectators: [...this.viewers].filter((t) => this.seatOf(t) < 0).length,
      autoRebuy: this.autoRebuy.has(token),
      log: e.log.slice(-60),
    };
  }

  lobbyInfo(): LobbyTable {
    const e = this.engine;
    const seated = e.seats.filter(Boolean);
    return {
      id: this.id, code: this.code, name: this.name, variantId: e.config.variantId, betting: e.config.betting,
      sb: e.config.sb, bb: e.config.bb, seatsTaken: seated.length, maxSeats: e.seats.length,
      humans: seated.filter((s) => !s!.isBot).length, bots: seated.filter((s) => s!.isBot).length,
      avgPot: this.potHistory.length ? Math.round(this.potHistory.reduce((a, b) => a + b, 0) / this.potHistory.length) : 0,
    };
  }

  destroy() {
    this.clearTimers();
    this.tick++;
  }
}
