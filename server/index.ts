import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import type { ClientMsg, ServerMsg } from '../shared/protocol';
import { MAX_BALANCE, Players, STARTING_BALANCE, TOP_UP } from './players';
import { Room } from './room';

// GAME_PORT, not PORT: dev tooling often sets PORT for the front-end server
const PORT = Number(process.env.GAME_PORT ?? 3001);
const DIST = path.resolve('dist');
const EMPTY_ROOM_MS = 2 * 60_000;

const players = new Players();
const rooms = new Map<string, Room>();

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => {
  let c = '';
  do c = Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  while ([...rooms.values()].some((r) => r.code === c));
  return c;
};

let lobbyTimer: NodeJS.Timeout | null = null;
function lobbyChanged() {
  if (lobbyTimer) return;
  lobbyTimer = setTimeout(() => {
    lobbyTimer = null;
    const tables = [...rooms.values()].filter((r) => !r.isPrivate).map((r) => r.lobbyInfo());
    for (const p of players.online()) if (!p.roomId) players.send(p.token, { t: 'lobby', tables });
  }, 400);
}

function sendLobby(token: string) {
  players.send(token, { t: 'lobby', tables: [...rooms.values()].filter((r) => !r.isPrivate).map((r) => r.lobbyInfo()) });
}

function leaveRoom(token: string) {
  const p = players.get(token);
  const room = p?.roomId ? rooms.get(p.roomId) : undefined;
  if (room) room.leave(token);
  if (p) p.roomId = undefined;
}

function handle(token: string | null, msg: ClientMsg, reply: (m: ServerMsg) => void, bind: (t: string) => void) {
  if (msg.t === 'hello') {
    const t = /^[a-zA-Z0-9-]{8,64}$/.test(msg.token) ? msg.token : null;
    if (!t) return reply({ t: 'toast', text: 'Bad session token', kind: 'error' });
    bind(t);
    const p = players.upsert(t, msg.name.trim().slice(0, 16) || 'Guest', msg.avatar);
    reply({ t: 'welcome', token: t, name: p.name, avatar: p.avatar, balance: p.balance });
    const room = p.roomId ? rooms.get(p.roomId) : undefined;
    if (room) { reply({ t: 'joined', code: room.code }); room.join(t); }
    else sendLobby(t);
    return;
  }
  if (!token) return reply({ t: 'toast', text: 'Say hello first', kind: 'error' });
  const p = players.get(token)!;
  const room = p.roomId ? rooms.get(p.roomId) : undefined;
  const err = (text: string | null) => { if (text) reply({ t: 'toast', text, kind: 'error' }); };

  switch (msg.t) {
    case 'rename':
      p.name = msg.name.trim().slice(0, 16) || p.name;
      p.avatar = msg.avatar;
      players.save();
      reply({ t: 'welcome', token, name: p.name, avatar: p.avatar, balance: p.balance });
      break;
    case 'topUp':
      p.balance = Math.min(MAX_BALANCE, p.balance + TOP_UP);
      players.save();
      reply({ t: 'balance', balance: p.balance });
      reply({ t: 'toast', text: `Added ${TOP_UP.toLocaleString()} play chips` });
      break;
    case 'resetChips':
      p.balance = STARTING_BALANCE;
      players.save();
      reply({ t: 'balance', balance: p.balance });
      break;
    case 'createTable': {
      leaveRoom(token);
      const id = Math.random().toString(36).slice(2, 10);
      const r = new Room(id, newCode(), msg.opts, token, players, lobbyChanged);
      const e = r.engine;
      const buyIn = Math.min(e.config.maxBuyIn, p.balance);
      if (buyIn < e.config.minBuyIn) {
        r.destroy();
        return err(`You need ${e.config.minBuyIn.toLocaleString()} chips to sit at this table. Top up first.`);
      }
      rooms.set(id, r);
      p.roomId = id;
      reply({ t: 'joined', code: r.code });
      r.join(token);
      r.sit(token, 0, buyIn, true);
      const n = Math.min(msg.opts.bots, e.seats.length - 1);
      for (let i = 1; i <= n; i++) r.addBot(i, msg.opts.personaIds[i - 1]);
      r.step();
      break;
    }
    case 'joinTable': {
      const target = [...rooms.values()].find((r) => r.code === msg.code.toUpperCase().trim());
      if (!target) return err('No table with that code');
      if (room && room !== target) leaveRoom(token);
      p.roomId = target.id;
      reply({ t: 'joined', code: target.code });
      target.join(token);
      break;
    }
    case 'leaveTable':
      leaveRoom(token);
      reply({ t: 'left' });
      sendLobby(token);
      break;
    case 'history':
      reply({ t: 'history', hands: p.history });
      break;
    default: {
      if (!room) return err('You are not at a table');
      switch (msg.t) {
        case 'sit': return err(room.sit(token, msg.seat, msg.buyIn, msg.autoRebuy)), room.step();
        case 'stand': return room.stand(token);
        case 'addChips': return err(room.addChips(token, msg.amount));
        case 'sitOut': return room.sitOut(token, msg.value);
        case 'action': return room.action(token, { type: msg.type, amount: msg.amount });
        case 'discard': return room.discard(token, msg.cards);
        case 'show': return room.show(token);
        case 'chat': return room.say(token, msg.text);
        case 'emote': return room.emote(token, msg.emote);
        case 'host': return err(room.host(token, msg.op, msg.seat, msg.personaId));
      }
    }
  }
}

// ---------- HTTP (built client) + WebSocket ----------

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
  let file = path.join(DIST, url);
  if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  if (!fs.existsSync(file)) {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('FELT poker server is running. In development open http://localhost:5173, or run "npm run build" first.');
    return;
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws) => {
  let token: string | null = null;
  const reply = (m: ServerMsg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); };
  const bind = (t: string) => {
    token = t;
    const prev = players.get(t)?.ws;
    if (prev && prev !== ws) prev.close(4000, 'Opened in another tab');
    players.upsert(t, 'Guest', '').ws = ws;
  };
  ws.on('message', (raw) => {
    let msg: ClientMsg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    try { handle(token, msg, reply, bind); }
    catch (e) { console.error(e); reply({ t: 'toast', text: 'Something went wrong', kind: 'error' }); }
  });
  ws.on('close', () => {
    if (!token) return;
    const p = players.get(token);
    if (p?.ws !== ws) return;
    p.ws = undefined;
    const room = p.roomId ? rooms.get(p.roomId) : undefined;
    if (room) {
      if (room.humanCount() === 0) room.emptySince = Date.now();
      room.refresh();
    }
  });
});

// Close rooms nobody has been connected to for a while, returning seated chips to balances
setInterval(() => {
  for (const [id, r] of rooms) {
    if (r.humanCount() > 0 || !r.emptySince || Date.now() - r.emptySince < EMPTY_ROOM_MS) continue;
    for (const t of [...r.viewers]) {
      r.leave(t);
      const p = players.get(t);
      if (p) p.roomId = undefined;
    }
    r.destroy();
    rooms.delete(id);
    lobbyChanged();
  }
}, 15_000);

server.listen(PORT, () => console.log(`FELT poker server on http://localhost:${PORT}`));
