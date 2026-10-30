import fs from 'node:fs';
import path from 'node:path';
import type { WebSocket } from 'ws';
import type { HandRecord, ServerMsg } from '../shared/protocol';

export const STARTING_BALANCE = 10_000;
export const TOP_UP = 10_000;
export const MAX_BALANCE = 1_000_000;

export interface Player {
  token: string;
  name: string;
  avatar: string;
  balance: number;
  history: HandRecord[];
  ws?: WebSocket;
  roomId?: string;
}

const FILE = path.resolve('data', 'players.json');

/** Guest players keyed by the random token each browser keeps. Balances persist to data/players.json. */
export class Players {
  private map = new Map<string, Player>();
  private saveTimer: NodeJS.Timeout | null = null;

  constructor() {
    try {
      const raw = JSON.parse(fs.readFileSync(FILE, 'utf8')) as Player[];
      for (const p of raw) this.map.set(p.token, { ...p, ws: undefined, roomId: undefined });
    } catch { /* first run */ }
  }

  get(token: string) { return this.map.get(token); }

  upsert(token: string, name: string, avatar: string): Player {
    let p = this.map.get(token);
    if (!p) {
      p = { token, name, avatar, balance: STARTING_BALANCE, history: [] };
      this.map.set(token, p);
    } else {
      p.name = name;
      p.avatar = avatar;
    }
    this.save();
    return p;
  }

  send(token: string, msg: ServerMsg) {
    const ws = this.map.get(token)?.ws;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  online(): Player[] { return [...this.map.values()].filter((p) => p.ws); }

  save() {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      const data = [...this.map.values()].map(({ ws, roomId, ...rest }) => rest);
      fs.writeFileSync(FILE, JSON.stringify(data));
    }, 1000);
  }
}
