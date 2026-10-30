import { ReactNode, useEffect, useState } from 'react';
import type { ChatMsg, PublicSeat, TableView } from '../../../../shared/protocol';
import { CardBack, EmptySlot, PlayingCard } from '../../components/Card';
import { ChipStack, fmt } from '../../components/Chips';
import { Avatar } from '../../components/ui';
import { send } from '../../net';
import { FELTS, useSettings } from '../../settings';

// Geometry from design_handoff 2a: plane 1100×720 tilted 58°, seats on an ellipse rx 470 / ry 300 about (550, 360).
export const TILT = 58;
export const P = (angle: number, k: number): [number, number] => [550 + k * 470 * Math.cos(angle * Math.PI / 180), 360 + k * 300 * Math.sin(angle * Math.PI / 180)];

export function seatAngle(view: TableView, i: number) {
  const n = view.seats.length;
  const step = 360 / n;
  if (view.mySeat >= 0) return 90 + ((i - view.mySeat + n) % n) * step;
  return 90 + step / 2 + i * step; // spectators: keep the bottom spot clear for the action bar
}

/** Positions children on the plane and stands them upright facing the camera. */
function Upright({ x, y, children, z }: { x: number; y: number; children: ReactNode; z?: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, transformStyle: 'preserve-3d', zIndex: z }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, transform: `translateX(-50%) rotateX(-${TILT}deg)`, transformOrigin: '50% 100%' }}>{children}</div>
    </div>
  );
}

const layers = Array.from({ length: 10 }, (_, i) => i);

export function Felt3D({ view, chat, now, onSeatClick, onSeatHover, onHostRemove }: {
  view: TableView; chat: ChatMsg[]; now: number;
  onSeatClick: (i: number) => void;
  onSeatHover: (i: number | null, el?: HTMLElement) => void;
  onHostRemove: (i: number) => void;
}) {
  const settings = useSettings();
  const isHost = view.hostId !== 'other';
  const handover = view.phase === 'handover' && view.result;
  const used = new Set(handover ? view.seats.flatMap((s) => s?.usedCards ?? []) : []);
  const pots = handover ? [] : view.pots;
  const boards = view.boards.length ? view.boards : [[]];
  const double = boards.length > 1;
  const cardW = double ? 60 : 74;

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: 52, bottom: 96, perspective: 1500, perspectiveOrigin: '50% 36%' }}>
      <div style={{ position: 'absolute', left: 90, top: -20, width: 1100, height: 720, transform: `rotateX(${TILT}deg)`, transformStyle: 'preserve-3d' }}>
        <div style={{ position: 'absolute', left: -30, top: -20, right: -30, bottom: -20, borderRadius: '50%', background: 'rgba(0,0,0,.75)', filter: 'blur(36px)', transform: 'translateZ(-90px)' }} />
        {layers.map((i) => <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: i % 2 ? '#2a170c' : '#3a2112', transform: `translateZ(${-(i + 1) * 4}px)` }} />)}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 20%,#5a5755,#2c2a29 60%,#171615)', boxShadow: 'inset 0 0 0 2px rgba(255,220,170,.35),inset 0 -10px 20px rgba(0,0,0,.5)' }} />
        <div style={{ position: 'absolute', inset: 34, borderRadius: '50%', background: 'linear-gradient(#262423,#141312)', boxShadow: 'inset 0 6px 14px rgba(0,0,0,.9),0 1px 0 rgba(255,220,170,.25)' }} />
        <div style={{ position: 'absolute', inset: 56, borderRadius: '50%', background: FELTS[settings.felt].plane, boxShadow: 'inset 0 0 70px rgba(0,0,0,.65)' }} />
        <div style={{ position: 'absolute', inset: '120px 150px', borderRadius: '50%', border: '2px solid rgba(214,180,100,.4)' }} />
        <div style={{ position: 'absolute', left: 550, top: 590, transform: 'translate(-50%,-50%)', font: '800 30px Archivo', letterSpacing: '.3em', color: 'rgba(255,255,255,.07)' }}>FELT</div>

        {view.button >= 0 && view.seats[view.button] ? <DealerButton angle={seatAngle(view, view.button)} /> : null}

        {/* Bets in front of seats */}
        {view.seats.map((s, i) => s && s.bet > 0 ? (
          <Upright key={`b${i}`} x={P(seatAngle(view, i), .6)[0]} y={P(seatAngle(view, i), .6)[1]}>
            <ChipStack amount={s.bet} w={30} label={fmt(s.bet)} />
          </Upright>
        ) : null)}

        {/* Pots */}
        {pots.map((p, k) => {
          const x = pots.length === 1 ? 550 : 550 + (k - (pots.length - 1) / 2) * 190;
          return (
            <Upright key={`p${k}`} x={x} y={(k === 0 ? 260 : 290) - (double ? 95 : 0)}>
              <ChipStack amount={p.amount} w={k === 0 ? 46 : 34} label={`${pots.length === 1 ? 'POT' : p.label} ${fmt(p.amount)}`} />
            </Upright>
          );
        })}

        {/* Flying winnings */}
        {handover ? view.result!.pots.flatMap((p, k) => p.awards.map((a, j) => (
          <FlyChips key={`${view.handNo}-${k}-${j}`} amount={a.amount} delay={(k * 2 + j) * 120} to={P(seatAngle(view, a.seat), view.mySeat === a.seat ? .95 : .82)} />
        ))) : null}

        {/* Board (hidden in the waiting room so the start plate owns the centre) */}
        {view.started && view.handNo > 0 ? <Upright x={550} y={double ? 470 : 450}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            {boards.map((b, bi) => (
              <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {double ? <span style={{ font: '800 12px Archivo', letterSpacing: '.14em', width: 18, color: '#f3f2f2' }}>{bi + 1}</span> : null}
                {Array.from({ length: 5 }, (_, k) => b[k]
                  ? <div key={b[k]} className="deal-in"><PlayingCard code={b[k]} w={cardW} hi={!!handover && used.has(b[k])} dim={!!handover && used.size > 0 && !used.has(b[k])} /></div>
                  : <EmptySlot key={`e${k}`} w={cardW} />)}
              </div>
            ))}
          </div>
        </Upright> : null}

        {/* Waiting room message */}
        {!view.started || (view.paused && view.phase === 'idle') ? (
          <Upright x={550} y={430} z={800}>
            <div className="plate" style={{ padding: '14px 20px', textAlign: 'center', minWidth: 300 }}>
              <div style={{ font: '800 20px Archivo' }}>{view.paused ? 'Game paused' : 'Waiting for players'}</div>
              <div className="muted" style={{ fontSize: 13, margin: '4px 0 10px' }}>Invite code <b style={{ letterSpacing: '.12em' }}>{view.code}</b> · {view.seats.filter(Boolean).length} seated</div>
              {isHost ? (
                <button className="btn primary small" disabled={view.seats.filter(Boolean).length < 2} onClick={() => send({ t: 'host', op: view.paused ? 'pause' : 'start' })}>
                  {view.paused ? 'Resume game' : 'Start game'}
                </button>
              ) : <div className="muted" style={{ fontSize: 12 }}>The host starts the game.</div>}
            </div>
          </Upright>
        ) : null}

        {/* Seats */}
        {view.seats.map((s, i) => {
          if (i === view.mySeat) return null;
          const [x, y] = P(seatAngle(view, i), 1);
          return (
            <Upright key={`s${i}`} x={x} y={y} z={Math.round(y)}>
              {s ? (
                <SeatPlate view={view} s={s} now={now} chat={chat} isHost={isHost}
                  onHover={(el) => onSeatHover(el ? i : null, el)} onRemove={() => onHostRemove(i)} />
              ) : (
                <EmptySeat view={view} isHost={isHost} onClick={() => onSeatClick(i)} />
              )}
            </Upright>
          );
        })}
      </div>
    </div>
  );
}

function DealerButton({ angle }: { angle: number }) {
  const [x, y] = P(angle - 14, .76);
  return (
    <div style={{ position: 'absolute', left: x - 20, top: y - 20, width: 40, height: 40, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#fff,#d9d2c0)', boxShadow: '0 4px 0 #8f8774,0 7px 8px rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '800 18px Archivo', color: '#201e1d', transition: 'left .5s ease, top .5s ease' }}>D</div>
  );
}

function FlyChips({ amount, to, delay }: { amount: number; to: [number, number]; delay: number }) {
  const [pos, setPos] = useState<[number, number]>([550, 260]);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const a = setTimeout(() => setPos(to), 300 + delay);
    const b = setTimeout(() => setGone(true), 2600 + delay);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ position: 'absolute', left: pos[0], top: pos[1], width: 0, height: 0, transformStyle: 'preserve-3d', transition: 'left .7s cubic-bezier(.2,.8,.3,1.1), top .7s cubic-bezier(.2,.8,.3,1.1), opacity .4s', opacity: gone ? 0 : 1, zIndex: 900 }}>
      <div style={{ position: 'absolute', bottom: 0, left: 0, transform: `translateX(-50%) rotateX(-${TILT}deg)`, transformOrigin: '50% 100%' }}>
        <ChipStack amount={amount} w={34} />
      </div>
    </div>
  );
}

function EmptySeat({ view, isHost, onClick }: { view: TableView; isHost: boolean; onClick: () => void }) {
  const canSit = view.mySeat < 0;
  const label = canSit ? 'Sit here' : isHost ? '+ Add bot' : 'Empty seat';
  const active = canSit || isHost;
  return (
    <button onClick={active ? onClick : undefined} disabled={!active}
      style={{ width: 150, height: 54, border: `2px dashed rgba(243,242,242,${active ? .6 : .25})`, background: active ? 'rgba(12,10,9,.55)' : 'transparent', color: '#f3f2f2', font: '700 13px Archivo', cursor: active ? 'pointer' : 'default', opacity: active ? 1 : .6 }}>
      {label}
    </button>
  );
}

function SeatPlate({ view, s, now, chat, isHost, onHover, onRemove }: {
  view: TableView; s: PublicSeat; now: number; chat: ChatMsg[]; isHost: boolean;
  onHover: (el?: HTMLElement) => void; onRemove: () => void;
}) {
  const settings = useSettings();
  const acting = view.toAct === s.index && view.turnEndsAt > 0;
  const left = acting ? Math.max(0, view.turnEndsAt - now) / Math.max(1, view.turnMs) : 0;
  const bubble = [...chat].reverse().find((m) => m.seat === s.index && now - m.ts < 4500 && (settings.botChat || m.kind !== 'bot'));
  const handover = view.phase === 'handover';
  const won = handover ? view.result?.totals[s.index] ?? 0 : 0;
  const hand = handover ? view.result?.hands[s.index] : undefined;
  const faded = (s.folded && s.inHand) || s.sittingOut || !s.inHand && view.phase !== 'idle';
  const pill = s.sittingOut ? 'Sitting out' : !s.connected ? 'Away' : s.lastAction;
  const pillStyle: React.CSSProperties = {
    font: '700 10px Archivo', letterSpacing: '.04em', padding: '3px 7px', borderRadius: 9, whiteSpace: 'nowrap',
    ...(s.lastAction?.startsWith('Bet') || s.lastAction?.startsWith('Raise') || s.lastAction === 'All-in'
      ? { background: '#ec3013', color: '#fff' }
      : s.lastAction === 'Fold' || s.sittingOut || !s.connected ? { background: '#4a4541', color: '#ddd' } : { background: '#f3f2f2', color: '#201e1d' }),
  };
  const cardW = s.hole && s.hole.length > 2 ? Math.max(28, 44 - s.hole.length * 3) : 40;
  const backW = s.cardCount > 2 ? 26 : 32;

  return (
    <div style={{ width: 176, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}
      onMouseEnter={(e) => onHover(e.currentTarget)} onMouseLeave={() => onHover(undefined)}>
      {won > 0 ? <div className="win-pop" style={{ font: '800 20px Archivo', color: '#4cc38a', textShadow: '0 2px 6px rgba(0,0,0,.8)', marginBottom: 4 }}>+{fmt(won)}</div> : null}
      {bubble ? (
        <div className="bubble" style={{ position: 'relative', marginBottom: 8, background: '#fff', color: '#201e1d', font: '600 12px/1.35 Archivo', padding: '7px 10px', borderRadius: 10, boxShadow: '0 4px 10px rgba(0,0,0,.5)', maxWidth: 170, textAlign: 'center' }}>
          {bubble.kind === 'emote' ? <span style={{ fontSize: 22 }}>{bubble.text}</span> : bubble.text}
        </div>
      ) : null}
      {hand?.high && s.hole ? (
        <div style={{ font: '700 11px Archivo', background: 'rgba(12,10,9,.85)', border: '1px solid rgba(243,242,242,.5)', padding: '2px 8px', marginBottom: 6, whiteSpace: 'nowrap' }}>
          {hand.board2 ? `${short(hand.high)} / ${short(hand.board2)}` : short(hand.high)}{hand.low ? ` · ${hand.low}` : ''}
        </div>
      ) : null}
      <div style={{ marginBottom: -12, position: 'relative', zIndex: 1, display: 'flex', gap: 2, minHeight: 20 }}>
        {s.inHand && !s.folded ? (
          s.hole ? s.hole.map((c, k) => (
            <PlayingCard key={c} code={c} w={cardW} hi={used(view, s, c)} dim={handover && s.usedCards.length > 0 && !s.usedCards.includes(c)} style={{ marginLeft: k ? -cardW * .25 : 0 }} />
          )) : Array.from({ length: s.cardCount }, (_, k) => (
            <div key={k} style={{ transform: `rotate(${(k - (s.cardCount - 1) / 2) * 7}deg)`, marginLeft: k ? -backW * .45 : 0 }}><CardBack w={backW} /></div>
          ))
        ) : null}
      </div>
      <div style={{ width: '100%', background: 'linear-gradient(#3a3837,#1d1b1a)', border: `1px solid ${acting ? '#ec3013' : 'rgba(243,242,242,.65)'}`, boxShadow: 'var(--plate-shadow)', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 9, opacity: faded ? .55 : 1, position: 'relative' }}>
        <div style={{ position: 'relative', flex: 'none' }}>
          {acting ? <div style={{ position: 'absolute', inset: -5, borderRadius: '50%', background: `conic-gradient(${left < .25 ? '#f2b33d' : '#ec3013'} 0 ${left * 100}%, rgba(255,255,255,.12) 0)` }} /> : null}
          <div style={{ position: 'relative' }}><Avatar code={s.avatar} size={38} grayscale /></div>
        </div>
        <div style={{ lineHeight: 1.25, minWidth: 0 }}>
          <div style={{ font: '700 13px Archivo', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 74 }}>{s.name}</div>
          <div style={{ font: '700 13px Archivo', color: '#f3f2f2' }}>{s.allIn && view.phase !== 'handover' ? 'ALL-IN' : fmt(s.stack)}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
          {s.isBot ? <span style={{ font: '800 8px Archivo', letterSpacing: '.1em', opacity: .6 }}>BOT</span> : null}
          {pill ? <span style={pillStyle}>{pill}</span> : null}
        </div>
        {isHost ? (
          <button className="seat-x" title={s.isBot ? 'Remove bot' : 'Remove player'} aria-label={s.isBot ? `Remove ${s.name}` : `Kick ${s.name}`} onClick={(e) => { e.stopPropagation(); onRemove(); }}>×</button>
        ) : null}
      </div>
    </div>
  );
}

const short = (name: string) => name.replace(/, .*kicker$/, '').replace('Three of a kind', 'Trips').replace('Four of a kind', 'Quads');
const used = (view: TableView, s: PublicSeat, c: string) => view.phase === 'handover' && s.usedCards.includes(c);
