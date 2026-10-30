import { useSyncExternalStore } from 'react';
import type { ChatMsg, ClientMsg, HandRecord, LobbyTable, ServerMsg, TableView } from '../../shared/protocol';

export interface Identity { token: string; name: string; avatar: string }

export interface Toast { id: number; text: string; kind: 'info' | 'error' }

export interface NetState {
  status: 'connecting' | 'open' | 'reconnecting';
  me: (Identity & { balance: number }) | null;
  lobby: LobbyTable[];
  table: TableView | null;
  tableCode: string | null;
  chat: ChatMsg[];
  history: HandRecord[];
  toasts: Toast[];
}

const ID_KEY = 'felt.identity';

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(ID_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveIdentity(id: Identity) {
  try { localStorage.setItem(ID_KEY, JSON.stringify(id)); } catch { /* private mode */ }
}

export const newToken = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

let state: NetState = { status: 'connecting', me: null, lobby: [], table: null, tableCode: null, chat: [], history: [], toasts: [] };
const listeners = new Set<() => void>();
const set = (patch: Partial<NetState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

let ws: WebSocket | null = null;
let retry = 0;
let toastId = 0;
const queue: ClientMsg[] = [];

export function toast(text: string, kind: Toast['kind'] = 'info') {
  const t = { id: ++toastId, text, kind };
  set({ toasts: [...state.toasts, t] });
  setTimeout(() => set({ toasts: state.toasts.filter((x) => x.id !== t.id) }), 3800);
}

function onMessage(m: ServerMsg) {
  switch (m.t) {
    case 'welcome': {
      const me = { token: m.token, name: m.name, avatar: m.avatar, balance: m.balance };
      saveIdentity({ token: m.token, name: m.name, avatar: m.avatar });
      return set({ me });
    }
    case 'balance': return state.me && set({ me: { ...state.me, balance: m.balance } });
    case 'lobby': return set({ lobby: m.tables });
    case 'table':
      m.view.turnEndsAt = m.view.turnLeftMs ? Date.now() + m.view.turnLeftMs : 0;
      return set({ table: m.view, tableCode: m.view.code });
    case 'joined':
      set({ tableCode: m.code });
      if (location.hash !== `#/t/${m.code}`) location.hash = `#/t/${m.code}`;
      return;
    case 'left':
      set({ table: null, tableCode: null, chat: [] });
      if (location.hash.startsWith('#/t/')) location.hash = '#/';
      return;
    case 'chat': return set({ chat: m.replace ? m.msgs : [...state.chat, ...m.msgs].slice(-150) });
    case 'history': return set({ history: m.hands });
    case 'toast': return toast(m.text, m.kind ?? 'info');
  }
}

export function connect() {
  const id = loadIdentity();
  if (!id || ws) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  const sock = new WebSocket(`${proto}://${location.host}/ws`);
  ws = sock;
  sock.onopen = () => {
    retry = 0;
    set({ status: 'open' });
    const cur = loadIdentity()!;
    sock.send(JSON.stringify({ t: 'hello', token: cur.token, name: cur.name, avatar: cur.avatar }));
    while (queue.length) sock.send(JSON.stringify(queue.shift()));
  };
  sock.onmessage = (ev) => onMessage(JSON.parse(ev.data));
  sock.onclose = (ev) => {
    ws = null;
    if (ev.code === 4000) { set({ status: 'reconnecting' }); toast('This table is open in another tab', 'error'); return; }
    set({ status: 'reconnecting' });
    retry = Math.min(retry + 1, 6);
    setTimeout(connect, 400 * retry);
  };
}

export function send(msg: ClientMsg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else { queue.push(msg); connect(); }
}

export function useNet(): NetState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

export const getNet = () => state;
