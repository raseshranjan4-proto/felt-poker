import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { bestHigh, bestLow } from '../../../../shared/evaluator';
import { personaById } from '../../../../shared/personas';
import type { TableView } from '../../../../shared/protocol';
import { bettingLabel, variantById } from '../../../../shared/variants';
import { Fan } from '../../components/Card';
import { ChipStack, fmt } from '../../components/Chips';
import { PersonaHover, SessionStats } from '../../components/PersonaCard';
import { Avatar, Modal } from '../../components/ui';
import { send, toast, useNet } from '../../net';
import { useSettings } from '../../settings';
import { PersonaPicker } from '../Gallery';
import { ActionBar } from './ActionBar';
import { Felt3D } from './Felt3D';

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/** Scales the 1280×800 design to fit the window. */
function useStageScale() {
  const [s, setS] = useState(1);
  useLayoutEffect(() => {
    const f = () => setS(Math.min(window.innerWidth / 1280, window.innerHeight / 800));
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return s;
}

export default function TableScreen({ code }: { code: string }) {
  const net = useNet();
  const view = net.table && net.table.code === code ? net.table : null;
  useEffect(() => {
    if (net.status === 'open' && net.tableCode !== code) send({ t: 'joinTable', code });
  }, [code, net.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!view) {
    return (
      <div className="stage-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ font: '800 22px Archivo', marginBottom: 8 }}>Finding table {code}…</div>
          <a href="#/" className="btn small">Back to lobby</a>
        </div>
      </div>
    );
  }
  return <Table view={view} />;
}

type Dialog = null | { kind: 'buyin'; seat: number } | { kind: 'rules' } | { kind: 'addChips' } | { kind: 'stand' } | { kind: 'leave' } | { kind: 'pickBot'; seat: number } | { kind: 'remove'; seat: number };

function Table({ view }: { view: TableView }) {
  const net = useNet();
  const settings = useSettings();
  const scale = useStageScale();
  const now = useNow(200);
  const stageRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<null | 'chat' | 'log' | 'info'>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [discardSel, setDiscardSel] = useState<string[]>([]);
  const [hover, setHover] = useState<{ seat: number; x: number; y: number } | null>(null);
  const [seenChat, setSeenChat] = useState(0);
  const stats = useSessionStats(view);

  const v = variantById(view.config.variantId);
  const me = view.mySeat >= 0 ? view.seats[view.mySeat] : null;
  const isHost = view.hostId !== 'other';
  const myTurn = !!view.legal;
  const secondsLeft = view.turnEndsAt ? Math.max(0, Math.ceil((view.turnEndsAt - now) / 1000)) : 0;

  useEffect(() => { if (view.phase !== 'discard') setDiscardSel([]); }, [view.phase]);
  useEffect(() => { if (panel === 'chat') setSeenChat(net.chat.length); }, [panel, net.chat.length]);
  const unread = Math.max(0, net.chat.filter((m) => m.kind !== 'system').length - net.chat.slice(0, seenChat).filter((m) => m.kind !== 'system').length);

  // Tab title nudges when it's your turn
  useEffect(() => { document.title = myTurn ? '● Your turn · FELT' : `${view.name} · FELT`; return () => { document.title = 'FELT · Poker'; }; }, [myTurn, view.name]);

  const role = view.mySeat === view.button ? 'BTN' : view.mySeat === view.sbSeat ? 'SB' : view.mySeat === view.bbSeat ? 'BB' : '';
  const discardN = v.discard?.count ?? 0;
  const discarding = view.phase === 'discard' && !!me?.needsDiscard;

  const onSeatHover = (seat: number | null, el?: HTMLElement) => {
    if (seat === null || !el || !stageRef.current || !view.seats[seat]?.isBot) return setHover(null);
    const r = el.getBoundingClientRect(), sr = stageRef.current.getBoundingClientRect();
    setHover({ seat, x: (r.left + r.width / 2 - sr.left) / scale, y: (r.top - sr.top) / scale });
  };

  const leave = () => {
    if (me && me.inHand && !me.folded && view.phase !== 'handover' && view.phase !== 'idle') setDialog({ kind: 'leave' });
    else { send({ t: 'leaveTable' }); location.hash = '#/'; }
  };

  const copyInvite = async () => {
    const url = `${location.origin}${location.pathname}#/t/${view.code}`;
    try { await navigator.clipboard.writeText(url); toast('Invite link copied'); } catch { toast(`Invite code: ${view.code}`); }
  };

  return (
    <div className="stage-wrap">
      <div ref={stageRef} className="stage" style={{ transform: `scale(${scale}) translate(-50%,-50%)` }}>
        {/* Header (2a) */}
        <div className="topbar" style={{ position: 'absolute', left: 0, right: 0, top: 0, borderBottomWidth: 1, zIndex: 6 }}>
          <button className="hud-btn" onClick={leave}>← Lobby</button>
          <span style={{ font: '800 17px Archivo', letterSpacing: '-.01em', whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>{view.name}</span>
          <span className="tag" title={`${v.name} · ${bettingLabel[view.config.betting]}`}>{v.tag}{view.config.betting !== v.betting[0] ? ` ${view.config.betting}` : ''} · {fmt(view.config.sb)}/{fmt(view.config.bb)}</span>
          {view.handNo ? <span style={{ font: '500 12px Archivo', opacity: .6 }}>Hand #{view.handNo}</span> : null}
          <span className="spacer" />
          {view.spectators ? <span style={{ font: '500 12px Archivo', opacity: .6 }}>{view.spectators} watching</span> : null}
          <button className="tag" style={{ background: 'none', color: 'inherit', cursor: 'pointer', borderColor: 'rgba(255,255,255,.3)' }} onClick={copyInvite} title="Copy invite link">INVITE {view.code}</button>
          {isHost && view.started ? <button className="hud-btn" onClick={() => send({ t: 'host', op: 'pause' })}>{view.paused ? 'Resume' : 'Pause'}</button> : null}
          <button className="hud-btn" onClick={() => setPanel(panel ? null : 'chat')}>Chat{unread && panel !== 'chat' ? <span className="unread">{unread}</span> : null}</button>
          <button className="hud-btn" onClick={() => setDialog({ kind: 'rules' })}>Rules</button>
          <span className="balance"><ChipStack amount={100} w={18} />{fmt(net.me?.balance ?? 0)}</span>
        </div>

        <Felt3D view={view} chat={net.chat} now={now}
          onSeatClick={(i) => (view.mySeat < 0 ? setDialog({ kind: 'buyin', seat: i }) : isHost ? setDialog({ kind: 'pickBot', seat: i }) : null)}
          onSeatHover={onSeatHover}
          onHostRemove={(i) => setDialog({ kind: 'remove', seat: i })} />

        {/* Vignette + soft top light */}
        <div style={{ position: 'absolute', inset: '52px 0 96px 0', pointerEvents: 'none', background: 'radial-gradient(ellipse at 50% 40%,transparent 45%,rgba(0,0,0,.7)),radial-gradient(ellipse 45% 35% at 50% 35%,rgba(255,236,190,.14),transparent)' }} />

        {/* Showdown banner (2b) */}
        {view.phase === 'handover' && view.result ? <ResultBanner view={view} /> : null}

        {me ? <HeroHud view={view} role={role} secondsLeft={secondsLeft} discarding={discarding} discardN={discardN} discardSel={discardSel} setDiscardSel={setDiscardSel} helper={settings.handHelper} /> : null}

        <ActionBar view={view} discardSel={discardSel} onDiscardDone={() => setDiscardSel([])} secondsLeft={secondsLeft}
          onStand={() => setDialog({ kind: 'stand' })} onAddChips={() => setDialog({ kind: 'addChips' })}
          onSit={() => { const i = view.seats.findIndex((s) => !s); if (i >= 0) setDialog({ kind: 'buyin', seat: i }); }} />

        {panel ? <SidePanel view={view} tab={panel} setTab={setPanel} /> : null}

        {hover && view.seats[hover.seat]?.personaId ? (
          <div style={{ position: 'absolute', left: Math.min(1280 - 280, Math.max(10, hover.x - 135)), top: Math.max(56, hover.y - 270), zIndex: 30, pointerEvents: 'none' }}>
            <PersonaHover p={personaById(view.seats[hover.seat]!.personaId)!} stats={stats[view.seats[hover.seat]!.personaId!]} />
          </div>
        ) : null}
      </div>

      <div className="rotate-hint">Turn your phone sideways for a bigger table.</div>

      {dialog?.kind === 'buyin' ? <BuyIn view={view} seat={dialog.seat} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'addChips' ? <AddChips view={view} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'rules' ? <Rules view={view} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === 'stand' ? (
        <Modal title="Stand up?" onClose={() => setDialog(null)} footer={<><button className="btn" onClick={() => setDialog(null)}>Stay seated</button><button className="btn primary" onClick={() => { send({ t: 'stand' }); setDialog(null); }}>Stand up</button></>}>
          <p style={{ margin: 0 }}>{me?.inHand && !me.folded && view.phase !== 'handover' ? 'You are in a hand. Standing up folds your cards. ' : ''}Your {fmt(me?.stack ?? 0)} chips go back to your balance. You can keep watching.</p>
        </Modal>
      ) : null}
      {dialog?.kind === 'leave' ? (
        <Modal title="Leave mid-hand?" onClose={() => setDialog(null)} footer={<><button className="btn" onClick={() => setDialog(null)}>Stay</button><button className="btn primary" onClick={() => { send({ t: 'leaveTable' }); location.hash = '#/'; }}>Fold and leave</button></>}>
          <p style={{ margin: 0 }}>Leaving now folds your hand. Your remaining {fmt(me?.stack ?? 0)} chips go back to your balance.</p>
        </Modal>
      ) : null}
      {dialog?.kind === 'remove' ? (
        <Modal title={`Remove ${view.seats[dialog.seat]?.name ?? 'player'}?`} onClose={() => setDialog(null)}
          footer={<><button className="btn" onClick={() => setDialog(null)}>Cancel</button><button className="btn primary" onClick={() => { const s = view.seats[dialog.seat]; send({ t: 'host', op: s?.isBot ? 'removeBot' : 'kick', seat: dialog.seat }); setDialog(null); }}>Remove</button></>}>
          <p style={{ margin: 0 }}>{view.seats[dialog.seat]?.isBot ? 'The bot leaves the table. If it is in a hand, its cards are folded.' : 'The player is removed from the table and their chips go back to their balance.'}</p>
        </Modal>
      ) : null}
      {dialog?.kind === 'pickBot' ? (
        <PersonaPicker single max={1} initial={[]} onClose={() => setDialog(null)} onPick={(ids) => { send({ t: 'host', op: 'addBot', seat: dialog.seat, personaId: ids[0] }); setDialog(null); }} />
      ) : null}
    </div>
  );
}

/** Per-bot stats for the hover card, collected while you sit at this table. */
function useSessionStats(view: TableView) {
  const ref = useRef<{ seen: number; stats: Record<string, SessionStats> }>({ seen: 0, stats: {} });
  if (view.phase === 'handover' && view.result && ref.current.seen !== view.handNo) {
    ref.current.seen = view.handNo;
    const myNet = view.mySeat >= 0 ? view.result.totals[view.mySeat] ?? 0 : 0;
    const myIn = view.mySeat >= 0 && view.seats[view.mySeat]?.inHand;
    for (const s of view.seats) {
      if (!s?.isBot || !s.personaId || !s.inHand) continue;
      const st = (ref.current.stats[s.personaId] ??= { hands: 0, bigPot: 0, vsYou: 0 });
      st.hands++;
      const won = view.result.totals[s.index] ?? 0;
      st.bigPot = Math.max(st.bigPot, won);
      // "vs you" is your rough result against this bot: its wins when you lost count against you, and the reverse
      const losers = Math.max(1, view.seats.filter((x) => x?.inHand && !(view.result!.totals[x.index] > 0)).length);
      if (myIn && won > 0 && myNet === 0) st.vsYou -= Math.round(won / losers);
      if (myIn && myNet > 0 && won === 0) st.vsYou += Math.round(myNet / losers);
    }
  }
  return ref.current.stats;
}

function ResultBanner({ view }: { view: TableView }) {
  const r = view.result!;
  const main = r.pots.find((p) => p.label !== 'Returned') ?? r.pots[0];
  const sides = new Set(main.awards.map((a) => a.side));
  const sub = sides.has('low') || sides.has('board2')
    ? `Pot ${fmt(main.amount)} · each side ${fmt(Math.floor(main.amount / 2))}`
    : r.pots.filter((p) => p.label !== 'Returned').length > 1 ? r.pots.filter((p) => p.label !== 'Returned').map((p) => `${p.label} ${fmt(p.amount)}`).join(' · ') : r.uncontested ? 'Everyone else folded' : `Pot ${fmt(main.amount)}`;
  return (
    <div className="rise" style={{ position: 'absolute', left: 48, top: 76, background: 'rgba(12,10,9,.88)', border: '1px solid rgba(243,242,242,.7)', padding: '14px 22px', maxWidth: 620, zIndex: 7, borderRadius: 0 }}>
      <div style={{ font: '800 24px Archivo', letterSpacing: '-.01em', color: '#f3f2f2' }}>{r.headline}</div>
      <div style={{ font: '13px Archivo', opacity: .8, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function HeroHud({ view, role, secondsLeft, discarding, discardN, discardSel, setDiscardSel, helper }: {
  view: TableView; role: string; secondsLeft: number; discarding: boolean; discardN: number;
  discardSel: string[]; setDiscardSel: (x: string[]) => void; helper: boolean;
}) {
  const me = view.seats[view.mySeat]!;
  const v = variantById(view.config.variantId);
  const hole = me.hole ?? [];
  const board = view.boards[0] ?? [];
  const acting = (view.toAct === view.mySeat || discarding) && view.turnEndsAt > 0;
  const frac = acting && view.turnMs ? secondsLeft / Math.ceil(view.turnMs / 1000) : 0;

  const best = useMemo(() => {
    if (!hole.length || !helper || me.folded) return null;
    // Before the discard, Pineapple-style hands are judged as Hold'em hands of what you hold
    const lines: string[] = [];
    let usedHole: string[] = [];
    try {
      const highs = view.boards.map((b) => bestHigh(hole, b, v.mode, v.rules));
      if (view.boards.length > 1 && board.length >= 3) highs.forEach((h, i) => lines.push(`Board ${i + 1}: ${h.name}`));
      else lines.push(highs[0].name);
      if (board.length >= 3) usedHole = hole.filter((c) => highs[0].cards.includes(c));
      if (v.hiLo && board.length >= 3) {
        const low = bestLow(hole, board, v.mode);
        lines.push(low ? low.name : 'No low');
      }
    } catch { return null; }
    return { lines, usedHole };
  }, [hole.join(), view.boards.map((b) => b.join()).join('|'), helper, me.folded]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = hole.length;
  const w = n <= 2 ? 96 : n === 3 ? 88 : n === 4 ? 80 : n === 5 ? 72 : 66;
  const handover = view.phase === 'handover';
  const toggle = (i: number) => {
    const c = hole[i];
    if (discardSel.includes(c)) setDiscardSel(discardSel.filter((x) => x !== c));
    else if (discardSel.length < discardN) setDiscardSel([...discardSel, c]);
  };

  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 96, height: 160, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 30, paddingBottom: 6, zIndex: 4, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 8 }}>
        <div style={{ width: 60, height: 60, borderRadius: '50%', background: acting ? `conic-gradient(${secondsLeft <= 5 ? '#f2b33d' : '#ec3013'} 0 ${frac * 100}%,rgba(255,255,255,.18) 0)` : 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#1d1b1a', font: '800 18px Archivo', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {acting ? <span aria-label={`${secondsLeft} seconds left`}>{secondsLeft}</span> : <Avatar code={me.avatar} size={40} ring={false} />}
          </div>
        </div>
        <div style={{ lineHeight: 1.3 }}>
          <div style={{ font: '700 14px Archivo' }}>You{role ? ` · ${role}` : ''}</div>
          <div style={{ font: '800 15px Archivo', color: '#f3f2f2' }}>{me.allIn && !handover ? 'ALL-IN' : fmt(me.stack)}</div>
          {view.result?.totals[view.mySeat] ? <div className="win-pop" style={{ font: '800 15px Archivo', color: '#4cc38a' }}>+{fmt(view.result.totals[view.mySeat])}</div> : null}
        </div>
      </div>
      <div style={{ position: 'relative', top: 2, pointerEvents: discarding ? 'auto' : 'none', opacity: me.folded ? .45 : 1, minWidth: 120 }}>
        {n ? (
          <Fan cards={hole} w={w} angle={n <= 2 ? 8 : 5} overlap={n <= 2 ? .15 : .3}
            lift={(i) => discarding ? discardSel.includes(hole[i]) : !handover && !!best?.usedHole.includes(hole[i]) && n > 2}
            hi={(i) => discarding ? discardSel.includes(hole[i]) : handover && me.usedCards.includes(hole[i])}
            dim={(i) => handover && me.usedCards.length > 0 && !me.usedCards.includes(hole[i])}
            onCard={discarding ? toggle : undefined} />
        ) : <div className="muted" style={{ font: '600 13px Archivo', paddingBottom: 30 }}>{me.sittingOut ? 'Sitting out' : 'Waiting for the next hand'}</div>}
      </div>
      {best && best.lines.length ? (
        <div style={{ font: '700 12px Archivo', padding: '6px 12px', background: 'rgba(12,10,9,.85)', border: '1px solid rgba(243,242,242,.6)', color: '#f3f2f2', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 260 }}>
          {best.lines.map((l) => <span key={l}>{l}</span>)}
        </div>
      ) : <div style={{ width: 120 }} />}
    </div>
  );
}

function SidePanel({ view, tab, setTab }: { view: TableView; tab: 'chat' | 'log' | 'info'; setTab: (t: 'chat' | 'log' | 'info' | null) => void }) {
  const net = useNet();
  const settings = useSettings();
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  // Scroll only the list itself; scrollIntoView would also shift the clipped stage
  useEffect(() => {
    const list = endRef.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [net.chat.length, tab, view.log.length]);
  const v = variantById(view.config.variantId);
  const say = () => { if (text.trim()) { send({ t: 'chat', text }); setText(''); } };
  const msgs = net.chat.filter((m) => settings.botChat || m.kind !== 'bot');

  return (
    <aside className="side-panel" aria-label="Table panel">
      <div className="side-tabs" role="tablist">
        {(['chat', 'log', 'info'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t === 'info' ? 'Table' : t === 'log' ? 'Hand log' : 'Chat'}</button>)}
        <button aria-label="Close panel" style={{ flex: 'none', width: 40 }} onClick={() => setTab(null)}>✕</button>
      </div>
      {tab === 'chat' ? (
        <>
          <div className="side-scroll">
            {msgs.length === 0 ? <div className="muted">No messages yet. Say hi.</div> : null}
            {msgs.map((m) => m.kind === 'system'
              ? <div key={m.id} className="chat-sys">{m.text}</div>
              : (
                <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Avatar code={m.avatar ?? ''} size={24} ring={false} grayscale />
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 12 }}>{m.name}</b>{m.kind === 'bot' ? <span style={{ font: '800 8px Archivo', letterSpacing: '.1em', opacity: .6, marginLeft: 6 }}>BOT</span> : null}
                    <span style={{ fontSize: 10, opacity: .45, marginLeft: 6 }}>{new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <div style={{ fontSize: m.kind === 'emote' ? 22 : 13, overflowWrap: 'anywhere' }}>{m.text}</div>
                  </div>
                </div>
              ))}
            <div ref={endRef} />
          </div>
          <div style={{ padding: 10, borderTop: '1px solid var(--rule-soft)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {['😂', '🤦', '🤔', '👏', '😎', '😱'].map((e) => <button key={e} className="pill" style={{ fontSize: 16, padding: '2px 8px' }} onClick={() => send({ t: 'emote', emote: e })} aria-label={`Send ${e}`}>{e}</button>)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="input" style={{ flex: 1, height: 36 }} value={text} maxLength={200} placeholder="Message the table" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') say(); }} />
              <button className="btn small primary" onClick={say}>Send</button>
            </div>
          </div>
        </>
      ) : tab === 'log' ? (
        <div className="side-scroll">
          {view.log.length === 0 ? <div className="muted">No hand yet.</div> : view.log.map((l, i) => <div key={i} style={{ fontWeight: /^(Flop|Turn|River|Hand)/.test(l) ? 700 : 400, opacity: /wins/.test(l) ? 1 : .85 }}>{l}</div>)}
          <div ref={endRef} />
        </div>
      ) : (
        <div className="side-scroll">
          <div><div className="eyebrow">Game</div><b>{v.name}</b> · {bettingLabel[view.config.betting]}</div>
          <div><div className="eyebrow">Blinds</div>{fmt(view.config.sb)}/{fmt(view.config.bb)}{view.config.ante ? ` · ante ${fmt(view.config.ante)}` : ''}</div>
          <div><div className="eyebrow">Buy-in</div>{fmt(view.config.minBuyIn)} to {fmt(view.config.maxBuyIn)}</div>
          <div><div className="eyebrow">Invite</div>Code <b>{view.code}</b> · {view.isPrivate ? 'private' : 'listed in lobby'}</div>
          <div className="eyebrow" style={{ marginTop: 8 }}>Players</div>
          {view.seats.map((s, i) => s ? (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar code={s.avatar} size={24} ring={false} grayscale />
              <span style={{ flex: 1 }}>{s.name}{i === view.mySeat ? ' (you)' : ''}{s.isBot ? <span className="muted" style={{ fontSize: 11 }}> · {personaById(s.personaId)?.nickname}</span> : null}</span>
              <b>{fmt(s.stack)}</b>
            </div>
          ) : null)}
          {view.spectators ? <div className="muted">{view.spectators} watching</div> : null}
        </div>
      )}
    </aside>
  );
}

function BuyIn({ view, seat, onClose }: { view: TableView; seat: number; onClose: () => void }) {
  const net = useNet();
  const bal = net.me?.balance ?? 0;
  const { minBuyIn, maxBuyIn } = view.config;
  const top = Math.min(maxBuyIn, bal);
  const [amt, setAmt] = useState(top);
  const [auto, setAuto] = useState(true);
  const afford = bal >= minBuyIn;
  return (
    <Modal title="Buy in" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button>{afford ? <button className="btn primary" onClick={() => { send({ t: 'sit', seat, buyIn: amt, autoRebuy: auto }); onClose(); }}>Sit with {fmt(amt)}</button> : <button className="btn primary" onClick={() => send({ t: 'topUp' })}>Add 10,000 chips</button>}</>}>
      {afford ? (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
            <ChipStack amount={amt} w={40} />
            <div><div className="eyebrow">Buy-in</div><div style={{ font: '800 32px Archivo' }}>{fmt(amt)}</div></div>
            <span className="spacer" />
            <div className="muted" style={{ textAlign: 'right', fontSize: 13 }}>Balance<br /><b>{fmt(bal)}</b></div>
          </div>
          <input className="slider" type="range" min={minBuyIn} max={top} step={view.config.bb} value={amt} onChange={(e) => setAmt(Number(e.target.value))} aria-label="Buy-in amount" />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }} className="muted"><span>Min {fmt(minBuyIn)}</span><span>Max {fmt(top)}</span></div>
          <label className="check"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />Auto-rebuy when I run out</label>
        </>
      ) : <p style={{ margin: 0 }}>This table needs at least {fmt(minBuyIn)} chips and you have {fmt(bal)}. Add free play chips to sit down.</p>}
    </Modal>
  );
}

function AddChips({ view, onClose }: { view: TableView; onClose: () => void }) {
  const net = useNet();
  const me = view.seats[view.mySeat]!;
  const room = Math.min(view.config.maxBuyIn - me.stack, net.me?.balance ?? 0);
  const [amt, setAmt] = useState(Math.max(0, room));
  return (
    <Modal title="Add chips" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={amt <= 0} onClick={() => { send({ t: 'addChips', amount: amt }); onClose(); }}>Add {fmt(amt)}</button></>}>
      {room > 0 ? (
        <>
          <p style={{ margin: 0 }}>Top up your stack of {fmt(me.stack)} to at most {fmt(view.config.maxBuyIn)}. Chips are added between hands.</p>
          <input className="slider" type="range" min={0} max={room} step={view.config.bb} value={amt} onChange={(e) => setAmt(Number(e.target.value))} aria-label="Chips to add" />
        </>
      ) : (net.me?.balance ?? 0) <= 0 ? (
        <>
          <p style={{ margin: 0 }}>Your balance is empty. Get free play chips, then add them to your stack.</p>
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={() => send({ t: 'topUp' })}>Get 10,000 free chips</button>
        </>
      ) : <p style={{ margin: 0 }}>You are already at the maximum buy-in.</p>}
    </Modal>
  );
}

const RANKINGS = ['Royal flush', 'Straight flush', 'Four of a kind', 'Full house', 'Flush', 'Straight', 'Three of a kind', 'Two pair', 'Pair', 'High card'];

function Rules({ view, onClose }: { view: TableView; onClose: () => void }) {
  const v = variantById(view.config.variantId);
  const ranks = v.rules.shortDeck ? RANKINGS.map((r) => (r === 'Full house' ? 'Flush' : r === 'Flush' ? 'Full house' : r)) : RANKINGS;
  return (
    <Modal title={v.name} onClose={onClose}>
      <p style={{ margin: 0 }}>{v.blurb}</p>
      <div><div className="eyebrow" style={{ marginBottom: 6 }}>How it plays · {bettingLabel[view.config.betting]}</div>
        <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {v.howTo.map((h) => <li key={h}>{h}</li>)}
          {view.config.betting === 'PL' ? <li>Pot-Limit: the biggest raise is the size of the pot after you call.</li> : null}
          {view.config.betting === 'FL' ? <li>Fixed-Limit: bets are {fmt(view.config.bb)} preflop and on the flop, {fmt(view.config.bb * 2)} on the turn and river, four bets per round at most.</li> : null}
        </ul>
      </div>
      <div><div className="eyebrow" style={{ marginBottom: 6 }}>Hand rankings, best first</div>
        <ol style={{ margin: 0, paddingLeft: 22, columns: 2 }}>{ranks.map((r) => <li key={r}>{r}</li>)}</ol>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>Shortcuts on your turn: F fold · C check/call · R raise · arrow keys change the size.</div>
    </Modal>
  );
}
