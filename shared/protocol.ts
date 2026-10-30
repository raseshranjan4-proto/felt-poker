import { Card } from './cards';
import { HandResult, Legal, Phase, TableConfig } from './engine';
import { Betting, Street } from './variants';

export interface PublicSeat {
  index: number;
  playerId: string;
  name: string;
  avatar: string;
  isBot: boolean;
  personaId?: string;
  stack: number;
  bet: number;
  inHand: boolean;
  folded: boolean;
  allIn: boolean;
  lastAction: string | null;
  sittingOut: boolean;
  connected: boolean;
  /** Face-up cards when visible to this viewer, otherwise null. */
  hole: Card[] | null;
  cardCount: number;
  shown: boolean;
  needsDiscard: boolean;
  usedCards: Card[]; // winning cards to highlight at showdown
}

export interface TableView {
  id: string;
  code: string;
  name: string;
  hostId: string;
  config: TableConfig;
  isPrivate: boolean;
  started: boolean;
  paused: boolean;
  handNo: number;
  phase: Phase;
  street: Street | 'showdown';
  boards: Card[][];
  pots: { label: string; amount: number }[];
  potTotal: number;
  currentBet: number;
  toAct: number;
  /** Sent as time remaining; the client converts it to a local deadline on receipt. */
  turnLeftMs: number;
  turnEndsAt: number;
  turnMs: number;
  button: number;
  sbSeat: number;
  bbSeat: number;
  seats: (PublicSeat | null)[];
  mySeat: number;
  legal: Legal | null;
  result: HandResult | null;
  spectators: number;
  autoRebuy: boolean;
  log: string[];
}

export interface LobbyTable {
  id: string;
  code: string;
  name: string;
  variantId: string;
  betting: Betting;
  sb: number;
  bb: number;
  seatsTaken: number;
  maxSeats: number;
  humans: number;
  bots: number;
  avgPot: number;
}

export interface ChatMsg {
  id: number;
  kind: 'player' | 'bot' | 'system' | 'emote';
  name: string;
  avatar?: string;
  seat?: number;
  text: string;
  ts: number;
}

export interface HandRecord {
  id: string;
  ts: number;
  tableName: string;
  game: string;
  stakes: string;
  hole: Card[];
  boards: Card[][];
  net: number;
  headline: string;
  log: string[];
}

export type BotDifficulty = 'Mixed' | 'Easy' | 'Medium' | 'Hard';

export interface CreateTableOpts {
  name: string;
  variantId: string;
  betting: Betting;
  maxSeats: number;
  sb: number;
  bb: number;
  ante: number;
  minBuyInBB: number;
  maxBuyInBB: number;
  turnSeconds: number;
  bots: number;
  botDifficulty: BotDifficulty;
  personaIds: string[];
  isPrivate: boolean;
  fillBots: boolean;
  autoStart: boolean;
}

export type ClientMsg =
  | { t: 'hello'; token: string; name: string; avatar: string }
  | { t: 'rename'; name: string; avatar: string }
  | { t: 'topUp' }
  | { t: 'resetChips' }
  | { t: 'createTable'; opts: CreateTableOpts }
  | { t: 'joinTable'; code: string }
  | { t: 'leaveTable' }
  | { t: 'sit'; seat: number; buyIn: number; autoRebuy: boolean }
  | { t: 'stand' }
  | { t: 'addChips'; amount: number }
  | { t: 'sitOut'; value: boolean }
  | { t: 'action'; type: 'fold' | 'check' | 'call' | 'raise'; amount?: number }
  | { t: 'discard'; cards: Card[] }
  | { t: 'show' }
  | { t: 'chat'; text: string }
  | { t: 'emote'; emote: string }
  | { t: 'host'; op: 'start' | 'pause' | 'addBot' | 'removeBot' | 'kick'; seat?: number; personaId?: string }
  | { t: 'history' };

export type ServerMsg =
  | { t: 'welcome'; token: string; name: string; avatar: string; balance: number }
  | { t: 'balance'; balance: number }
  | { t: 'lobby'; tables: LobbyTable[] }
  | { t: 'table'; view: TableView }
  | { t: 'joined'; code: string }
  | { t: 'left' }
  | { t: 'chat'; msgs: ChatMsg[]; replace?: boolean }
  | { t: 'history'; hands: HandRecord[] }
  | { t: 'toast'; text: string; kind?: 'info' | 'error' };
