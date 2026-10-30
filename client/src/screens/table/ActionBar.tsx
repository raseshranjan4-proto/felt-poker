import { useEffect, useMemo, useRef, useState } from 'react';
import type { TableView } from '../../../../shared/protocol';
import { variantById } from '../../../../shared/variants';
import { ChipStack, fmt } from '../../components/Chips';
import { send } from '../../net';
import { useSettings } from '../../settings';

type Pre = 'checkfold' | 'check' | 'callany' | 'fold' | null;

const BAR: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 0, height: 96, background: 'linear-gradient(#201e1d,#151413)',
  borderTop: '1px solid rgba(243,242,242,.5)', display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px', zIndex: 5,
};

export function ActionBar({ view, discardSel, onDiscardDone, secondsLeft, onStand, onAddChips, onSit }: {
  view: TableView; discardSel: string[]; onDiscardDone: () => void; secondsLeft: number;
  onStand: () => void; onAddChips: () => void; onSit: () => void;
}) {
  const me = view.mySeat >= 0 ? view.seats[view.mySeat] : null;
  const legal = view.legal;
  const settings = useSettings();
  const [pre, setPre] = useState<Pre>(null);
  const preAt = useRef(0);

  // Pre-action choices clear when the price changes
  useEffect(() => { if (pre && view.currentBet !== preAt.current) setPre(null); }, [view.currentBet, pre]);
  useEffect(() => { setPre(null); }, [view.handNo, view.street]);
  useEffect(() => {
    if (!legal || !pre) return;
    const p = pre;
    setPre(null);
    if (p === 'checkfold') send({ t: 'action', type: legal.canCheck ? 'check' : 'fold' });
    else if (p === 'check' && legal.canCheck) send({ t: 'action', type: 'check' });
    else if (p === 'callany') send({ t: 'action', type: 'call' });
    else if (p === 'fold') send({ t: 'action', type: legal.canCheck ? 'check' : 'fold' });
  }, [legal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Not seated: spectator prompt
  if (!me) {
    const open = view.seats.some((s) => !s);
    return (
      <div style={BAR}>
        <div style={{ font: '800 17px Archivo' }}>You're watching.</div>
        <div className="muted">{open ? 'Pick an empty seat on the table to sit down.' : 'The table is full. You can stay and watch.'}</div>
        <span className="spacer" />
        {open ? <button className="btn primary" onClick={onSit}>Sit down</button> : null}
      </div>
    );
  }

  // Discard step
  if (view.phase === 'discard' && me.needsDiscard) {
    const n = variantById(view.config.variantId).discard?.count ?? 1;
    return (
      <div style={{ ...BAR, height: 96 }}>
        <div style={{ font: '800 20px Archivo', width: 170 }}>Discard {n} card{n > 1 ? 's' : ''}</div>
        <div className="muted" style={{ fontSize: 13 }}>Tap cards in your hand to mark them. {discardSel.length} of {n} selected.</div>
        <span className="spacer" />
        {secondsLeft ? <div style={{ font: '800 24px Archivo' }}>{secondsLeft}s</div> : null}
        <button className="act raise" disabled={discardSel.length !== n} onClick={() => { send({ t: 'discard', cards: discardSel }); onDiscardDone(); }}>Confirm discard</button>
      </div>
    );
  }

  if (legal) return <MyTurn view={view} />;

  const seatMenu = (
    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
      {me.stack === 0 || me.stack < view.config.maxBuyIn ? <button className="btn small" onClick={onAddChips}>Add chips</button> : null}
      {me.sittingOut
        ? <button className="btn small primary" disabled={me.stack === 0} onClick={() => send({ t: 'sitOut', value: false })}>I'm back</button>
        : <button className="btn small" onClick={() => send({ t: 'sitOut', value: true })}>Sit out next hand</button>}
      <button className="btn small" onClick={onStand}>Stand up</button>
    </div>
  );

  // Waiting for the host
  if (!view.started) {
    return (
      <div style={BAR}>
        <div style={{ font: '800 17px Archivo' }}>{view.hostId !== 'other' ? 'Start when everyone is seated.' : 'Waiting for the host to start.'}</div>
        <div className="muted" style={{ fontSize: 13 }}>Share code <b>{view.code}</b> so friends can join.</div>
        {seatMenu}
      </div>
    );
  }

  const inHand = me.inHand && !me.folded && (view.phase === 'betting' || view.phase === 'discard' || view.phase === 'runout');
  if (inHand && !me.allIn) {
    const opts: [Pre, string][] = [['checkfold', 'Check / Fold'], ['check', 'Check'], ['callany', 'Call any'], ['fold', 'Fold']];
    return (
      <div style={{ ...BAR, gap: 12 }}>
        {opts.map(([k, label]) => (
          <button key={k} className="check" aria-pressed={pre === k}
            onClick={() => { preAt.current = view.currentBet; setPre(pre === k ? null : k); }}
            style={{ padding: '12px 16px', border: '2px solid rgba(243,242,242,.5)', font: '600 13px Archivo', background: 'transparent', color: 'inherit' }}>
            <span style={{ width: 16, height: 16, background: pre === k ? '#ec3013' : '#060505', border: '2px solid #f3f2f2', display: 'inline-block' }} />{label}
          </button>
        ))}
        <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>Selections clear when the price changes</span>
        {seatMenu}
      </div>
    );
  }

  const won = (view.result?.totals[view.mySeat] ?? 0) > 0;
  const canShow = view.phase === 'handover' && me.inHand && !me.shown && (!settings.autoMuck || won);
  return (
    <div style={BAR}>
      <div className="muted" style={{ font: '600 14px Archivo' }}>
        {me.sittingOut ? (me.stack === 0 ? "You're out of chips." : "You're sitting out.")
          : me.allIn && view.phase !== 'handover' ? "You're all-in." : me.folded && view.phase !== 'handover' ? 'Folded. Waiting for the next hand.' : view.paused ? 'Game paused by the host.' : 'Next hand starting soon.'}
      </div>
      {canShow ? <button className="btn small" onClick={() => send({ t: 'show' })}>Show cards</button> : null}
      {seatMenu}
    </div>
  );
}

function MyTurn({ view }: { view: TableView }) {
  const legal = view.legal!;
  const me = view.seats[view.mySeat]!;
  const fl = view.config.betting === 'FL';
  const pl = view.config.betting === 'PL';
  const allInTo = me.bet + me.stack;
  const [amount, setAmount] = useState(legal.minTo);
  const [text, setText] = useState(String(legal.minTo));
  useEffect(() => { setAmount(legal.minTo); setText(String(legal.minTo)); }, [legal.minTo, view.toAct, view.street]);

  const clamp = (x: number) => Math.max(legal.minTo, Math.min(legal.maxTo, Math.round(x)));
  const presets = useMemo(() => {
    const potAfterCall = legal.potSize + legal.toCall;
    const at = (f: number) => clamp(me.bet + legal.toCall + f * potAfterCall);
    const list: [string, number][] = [['Min', legal.minTo], ['½ Pot', at(.5)], ['¾ Pot', at(.75)], ['Pot', at(1)]];
    if (!pl || legal.maxTo === allInTo) list.push(['All-in', legal.maxTo]);
    return list;
  }, [legal, me.bet, pl, allInTo]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (x: number) => { const v = clamp(x); setAmount(v); setText(String(v)); };
  const fold = () => send({ t: 'action', type: 'fold' });
  const call = () => send({ t: 'action', type: legal.canCheck ? 'check' : 'call' });
  const raise = () => send({ t: 'action', type: 'raise', amount: fl ? legal.minTo : amount });

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') { if (e.key === 'Enter' && legal.canRaise) raise(); return; }
      const key = e.key.toLowerCase();
      if (key === 'f') fold();
      else if (key === 'c') call();
      else if ((key === 'r' || key === 'enter') && legal.canRaise) raise();
      else if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); set(amount + view.config.bb); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); set(amount - view.config.bb); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  const raiseAmt = fl ? legal.minTo : amount;
  const raiseLabel = raiseAmt >= allInTo ? `All-in ${fmt(raiseAmt)}` : legal.isBet ? `Bet ${fmt(raiseAmt)}` : `Raise to ${fmt(raiseAmt)}`;
  const callLabel = legal.canCheck ? 'Check' : legal.toCall >= me.stack ? `All-in ${fmt(legal.toCall)}` : `Call ${fmt(legal.toCall)}`;
  const frac = legal.maxTo > legal.minTo ? (amount - legal.minTo) / (legal.maxTo - legal.minTo) : 1;

  return (
    <div style={{ ...BAR }} role="group" aria-label="Your action">
      <button className="act fold" onClick={fold}>Fold <small>F</small></button>
      <button className="act call" onClick={call}>{callLabel} <small>C</small></button>
      {legal.canRaise && !fl && legal.maxTo > legal.minTo ? (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, padding: '0 8px', minWidth: 200 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {presets.map(([l, v]) => <button key={l} className={`pill${v === amount ? ' on' : ''}`} onClick={() => set(v)}>{l}</button>)}
            </div>
            <div style={{ position: 'relative', height: 10, borderRadius: 5, background: '#050404', boxShadow: 'inset 0 2px 3px #000,0 1px 0 rgba(255,255,255,.12)' }}>
              <div style={{ width: `${frac * 100}%`, height: 10, borderRadius: 5, background: 'linear-gradient(#ff5a3d,#c2210a)' }} />
              <div style={{ position: 'absolute', left: `${frac * 100}%`, top: -14, transform: 'translateX(-50%)', filter: 'drop-shadow(0 4px 3px rgba(0,0,0,.6))', pointerEvents: 'none' }}><ChipStack amount={100} w={34} /></div>
              {pl ? <>
                <div style={{ position: 'absolute', right: 0, top: -18, width: 2, height: 42, background: '#f3f2f2' }} />
                <div style={{ position: 'absolute', right: 8, top: -34, font: '700 10px Archivo', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>MAX = POT {fmt(legal.maxTo)}</div>
              </> : null}
              <input type="range" aria-label="Bet size" min={legal.minTo} max={legal.maxTo} step={1} value={amount} onChange={(e) => set(Number(e.target.value))}
                style={{ position: 'absolute', inset: '-14px 0', width: '100%', opacity: 0, cursor: 'pointer', margin: 0 }} />
            </div>
          </div>
          <input aria-label="Bet amount" value={text} inputMode="numeric"
            onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ''))}
            onBlur={() => set(Number(text) || legal.minTo)}
            style={{ width: 104, height: 56, borderRadius: 8, background: '#060505', boxShadow: 'inset 0 2px 5px #000,0 1px 0 rgba(255,255,255,.14)', border: 0, padding: '0 14px', font: '800 20px Archivo', color: '#f3f2f2' }} />
        </>
      ) : <span className="spacer" />}
      {legal.canRaise ? <button className="act raise" onClick={raise}>{raiseLabel} <small>R</small></button> : null}
      {fl && legal.raisesLeft !== null ? <span className="badge" style={{ border: '2px solid rgba(243,242,242,.5)', padding: '4px 10px', fontSize: 11 }}>{legal.canRaise ? `Raise ${5 - legal.raisesLeft} of 4` : 'Raises capped'}</span> : null}
    </div>
  );
}
