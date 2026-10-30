# FELT · Poker prototype

Web poker with 15 Hold'em and Omaha variants, 260 bot personas, and multiplayer tables. Play chips only.

## Run it

Needs Node 20+.

```bash
npm install
npm run dev          # game server on :3001 + web app on http://localhost:5173
```

Production-style, one port:

```bash
npm run build
npm start            # serves the app and game server on http://localhost:3001
```

Set `GAME_PORT` to change the server port (not `PORT`, which dev tools often set for the web app).

### Playing with friends

- Same Wi-Fi: run `npm run dev`, then friends open `http://<your-computer's-IP>:5173` (Vite prints the Network address).
- Over the internet: run `npm run build && npm start`, then expose port 3001 with a tunnel such as `ngrok http 3001` and share the link.
- In the game: Create private table, then copy the invite link from the header (or share the 6-character code).

## Hosting on Render

`render.yaml` describes a free Node web service. In Render choose New → Blueprint, pick this repository, and apply. It builds with `npm run build`, starts with `npm start`, and redeploys on every push to `main`.

Free-tier notes: the service sleeps after 15 minutes without traffic (the first visit then takes about 30 to 50 seconds), and the disk is not persistent, so guest balances reset when the service restarts.

## Checks

```bash
npm test             # hand rankings, betting rules, side pots, splits, bots across all variants
npm run typecheck
```

## How it is built

| Folder | What lives there |
| --- | --- |
| `shared/` | Code used by both server and browser: cards, hand evaluator, the 15 variant configs, the game engine, bot personas and bot logic, the message protocol |
| `server/` | Node + WebSocket server: rooms, seating, turn timers, bots acting, reconnects, guest balances (saved to `data/players.json`) |
| `client/` | React app: lobby, 3D table, action bars, bot gallery, hand history, settings |
| `tests/` | Vitest suites |

- **Engine** (`shared/engine.ts`): one engine for every variant. A variant sets hole cards, deck (52, Short Deck 36, Royal 20), number of boards, Hold'em vs Omaha "exactly two" rule, Hi-Lo, discard steps (Pineapple, Crazy Pineapple, Irish) and Courchevel's early flop card. No-Limit, Pot-Limit and Fixed-Limit betting with side pots, uncalled-bet returns and odd-chip rules.
- **Server is authoritative**: it shuffles and deals, and each browser only receives its own hole cards (others are revealed at showdown or on an all-in run-out).
- **Bots** (`shared/personas.ts`, `shared/bot.ts`): 8 archetypes × named personas = 260. Each has 7 traits (looseness, aggression, bluffing, tilt, discipline, position sense, chattiness) that shape a decision built on a Monte Carlo win-chance estimate, plus think time, table talk and tilt after big losses.
- **UI** follows `design_handoff_poker_ui` (mockups v2): tilted 3D table, classic cards, three card backs, casino chip stacks, Archivo type, accent `#ec3013`.

## Not in this prototype

Real money, accounts and passwords, tournaments, Stud and Draw games (listed as "Coming soon"), sound, and illustrated persona portraits (initials placeholders, as in the mockups). Portrait phones show the whole table scaled down with a hint to rotate.
