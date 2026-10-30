import { useMemo, useState } from 'react';
import type { CreateTableOpts, BotDifficulty } from '../../../shared/protocol';
import { Betting, bettingLabel, COMING_SOON, variantById, VARIANTS } from '../../../shared/variants';
import { CardBack, Fan } from '../components/Card';
import { ChipStack, fmt } from '../components/Chips';
import { Modal, Seg, TopBar } from '../components/ui';
import { send, useNet } from '../net';
import { PersonaPicker } from './Gallery';

export const practiceOpts = (name: string): CreateTableOpts => ({
  name: `${name}'s practice`, variantId: 'nlhe', betting: 'NL', maxSeats: 6, sb: 50, bb: 100, ante: 0,
  minBuyInBB: 40, maxBuyInBB: 100, turnSeconds: 30, bots: 5, botDifficulty: 'Mixed', personaIds: [],
  isPrivate: true, fillBots: true, autoStart: true,
});

type Family = 'all' | 'holdem' | 'omaha';
type Sort = 'free' | 'stakes' | 'pot';

export default function Lobby() {
  const net = useNet();
  const [family, setFamily] = useState<Family>('all');
  const [game, setGame] = useState('all');
  const [sort, setSort] = useState<Sort>('free');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  const tables = useMemo(() => {
    const list = net.lobby.filter((t) => {
      const v = variantById(t.variantId);
      return (family === 'all' || v.family === family) && (game === 'all' || v.id === game);
    });
    return list.sort((a, b) =>
      sort === 'free' ? (b.maxSeats - b.seatsTaken) - (a.maxSeats - a.seatsTaken)
        : sort === 'stakes' ? b.bb - a.bb : b.avgPot - a.avgPot);
  }, [net.lobby, family, game, sort]);

  const quick = [
    { k: 'Solo', t: 'Practice vs bots', d: "Seat down in one click. No-Limit Hold'em, 6 seats.", deco: <Fan cards={['Ah', 'Ad']} w={52} angle={6} overlap={.45} />, go: () => send({ t: 'createTable', opts: practiceOpts(net.me?.name ?? 'My') }) },
    { k: 'Friends', t: 'Create private table', d: 'Pick a game, share a link.', deco: <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}><ChipStack amount={125} w={28} /><ChipStack amount={500} w={28} /></div>, go: () => setCreating(true) },
    { k: 'Invite', t: 'Join with code', d: 'Enter a 6-character table code.', deco: <div style={{ display: 'flex' }}><CardBack w={40} style={{ transform: 'rotate(-6deg)' }} /><CardBack w={40} style={{ marginLeft: -26, transform: 'rotate(10deg)' }} /></div>, go: () => setJoining(true) },
  ];

  return (
    <div className="page">
      <TopBar />
      <main className="page-body">
        <div className="quick">
          {quick.map((q) => (
            <button key={q.k} onClick={q.go}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, zIndex: 1 }}>
                <div className="kicker">{q.k}</div>
                <div className="q-title">{q.t}</div>
                <div className="q-desc">{q.d}</div>
              </div>
              <div className="q-deco">{q.deco}</div>
            </button>
          ))}
        </div>

        <div className="filters">
          {(['all', 'holdem', 'omaha'] as Family[]).map((f) => (
            <button key={f} className="chipbtn" aria-pressed={family === f} onClick={() => { setFamily(f); setGame('all'); }}>
              {f === 'all' ? 'All' : f === 'holdem' ? "Hold'em family" : 'Omaha family'}
            </button>
          ))}
          <span className="spacer" />
          <select className="select" aria-label="Game" value={game} onChange={(e) => setGame(e.target.value)}>
            <option value="all">All {VARIANTS.length} games</option>
            {VARIANTS.filter((v) => family === 'all' || v.family === family).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
            <optgroup label="Coming soon">{COMING_SOON.map((c) => <option key={c} disabled>{c}</option>)}</optgroup>
          </select>
          <select className="select" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ minWidth: 150 }}>
            <option value="free">Sort: Seats free</option>
            <option value="stakes">Sort: Stakes</option>
            <option value="pot">Sort: Avg pot</option>
          </select>
        </div>

        <div className="tl-head"><span>Table</span><span>Game</span><span>Blinds</span><span>Seats</span><span>Humans / bots</span><span>Avg pot</span><span /></div>
        {tables.length === 0 ? (
          <div className="empty">
            <div style={{ font: '800 20px Archivo', marginBottom: 6 }}>No open tables{game !== 'all' || family !== 'all' ? ' for this filter' : ''}.</div>
            <div className="muted" style={{ marginBottom: 16 }}>Create one and it shows up here for everyone on this server.</div>
            <button className="btn primary" onClick={() => setCreating(true)}>Create table</button>
          </div>
        ) : tables.map((t) => {
          const full = t.seatsTaken >= t.maxSeats;
          const v = variantById(t.variantId);
          return (
            <div className="tl-row" key={t.id}>
              <span style={{ fontWeight: 700 }}>{t.name}</span>
              <span className="mob">{v.tag} · {fmt(t.sb)}/{fmt(t.bb)} · {t.seatsTaken}/{t.maxSeats} seats</span>
              <span className="desk"><span className="gtag">{v.tag}</span></span>
              <span className="desk">{fmt(t.sb)}/{fmt(t.bb)}</span>
              <span className="desk">{t.seatsTaken}/{t.maxSeats}</span>
              <span className="desk">{t.humans} / {t.bots}</span>
              <div className="desk" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 30 }}>{t.avgPot ? <><ChipStack amount={t.avgPot} w={14} /><span>{fmt(t.avgPot)}</span></> : <span className="muted">—</span>}</div>
              <span><button className={`btn small ${full ? '' : 'primary'}`} onClick={() => send({ t: 'joinTable', code: t.code })}>{full ? 'Watch' : 'Join'}</button></span>
            </div>
          );
        })}
      </main>
      {creating ? <CreateTable onClose={() => setCreating(false)} /> : null}
      {joining ? <JoinCode onClose={() => setJoining(false)} /> : null}
    </div>
  );
}

function JoinCode({ onClose }: { onClose: () => void }) {
  const [code, setCode] = useState('');
  const ok = /^[A-Z0-9]{6}$/.test(code);
  const go = () => { send({ t: 'joinTable', code }); onClose(); };
  return (
    <Modal title="Join with code" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancel</button><button className="btn primary" disabled={!ok} onClick={go}>Join table</button></>}>
      <label className="field">
        <span>Table code</span>
        <input className="input" autoFocus value={code} maxLength={6} placeholder="K7Q2XP" style={{ font: '800 28px Archivo', letterSpacing: '.2em', height: 60, textTransform: 'uppercase' }}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} onKeyDown={(e) => { if (e.key === 'Enter' && ok) go(); }} />
      </label>
      <p className="muted" style={{ margin: 0 }}>Ask the host for the code shown in their table header, or open the invite link they shared.</p>
    </Modal>
  );
}

const BLINDS: [number, number][] = [[5, 10], [25, 50], [50, 100], [100, 200], [500, 1000]];

function CreateTable({ onClose }: { onClose: () => void }) {
  const net = useNet();
  const [o, setO] = useState<CreateTableOpts>({
    name: `${net.me?.name ?? 'My'}'s table`, variantId: 'nlhe', betting: 'NL', maxSeats: 6, sb: 50, bb: 100, ante: 0,
    minBuyInBB: 40, maxBuyInBB: 100, turnSeconds: 30, bots: 3, botDifficulty: 'Mixed', personaIds: [],
    isPrivate: true, fillBots: false, autoStart: false,
  });
  const [picking, setPicking] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const v = variantById(o.variantId);
  const up = (p: Partial<CreateTableOpts>) => setO((x) => ({ ...x, ...p }));
  const seats = Math.min(o.maxSeats, v.maxSeats);
  const maxBuy = o.maxBuyInBB * o.bb;
  const minBuy = o.minBuyInBB * o.bb;
  const canAfford = (net.me?.balance ?? 0) >= minBuy;

  return (
    <Modal title="Create table" onClose={onClose}
      footer={<>
        {!canAfford ? <span className="muted" style={{ marginRight: 'auto', alignSelf: 'center', fontSize: 13 }}>You need {fmt(minBuy)} chips to sit. Add chips first.</span> : null}
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={!canAfford} onClick={() => { send({ t: 'createTable', opts: { ...o, maxSeats: seats, bots: Math.min(o.bots, seats - 1) } }); onClose(); }}>Create table</button>
      </>}>
      <label className="field"><span>Table name</span><input className="input" value={o.name} maxLength={32} onChange={(e) => up({ name: e.target.value })} /></label>
      <label className="field">
        <span>Game</span>
        <select className="select" value={o.variantId} onChange={(e) => { const nv = variantById(e.target.value); up({ variantId: nv.id, betting: nv.betting[0], maxSeats: Math.min(o.maxSeats, nv.maxSeats) }); }}>
          <optgroup label="Hold'em family">{VARIANTS.filter((x) => x.family === 'holdem').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
          <optgroup label="Omaha family">{VARIANTS.filter((x) => x.family === 'omaha').map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</optgroup>
        </select>
        <small className="muted" style={{ fontSize: 12 }}>{v.blurb}</small>
      </label>
      {v.betting.length > 1 ? (
        <div className="field"><span>Betting</span><Seg value={o.betting} onChange={(b: Betting) => up({ betting: b })} options={v.betting.map((b) => ({ value: b, label: bettingLabel[b] }))} /></div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="field">
          <span>Seats</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn small" onClick={() => up({ maxSeats: Math.max(2, seats - 1) })} aria-label="Fewer seats">−</button>
            <b style={{ font: '800 20px Archivo', minWidth: 24, textAlign: 'center' }}>{seats}</b>
            <button className="btn small" onClick={() => up({ maxSeats: Math.min(v.maxSeats, seats + 1) })} aria-label="More seats">+</button>
            <span className="muted" style={{ fontSize: 12 }}>max {v.maxSeats}</span>
          </div>
        </div>
        <div className="field"><span>Turn timer</span><Seg value={o.turnSeconds} onChange={(t) => up({ turnSeconds: t })} options={[15, 30, 60].map((t) => ({ value: t, label: `${t} s` }))} /></div>
      </div>
      <div className="field">
        <span>Blinds</span>
        <Seg value={`${o.sb}/${o.bb}`} onChange={(s) => { const [sb, bb] = s.split('/').map(Number); up({ sb, bb }); }} options={BLINDS.map(([s, b]) => ({ value: `${s}/${b}`, label: `${fmt(s)}/${fmt(b)}` }))} />
        <small className="muted" style={{ fontSize: 12 }}>Buy-in {fmt(minBuy)} to {fmt(maxBuy)} ({o.minBuyInBB} to {o.maxBuyInBB} big blinds){v.betting.includes('FL') && o.betting === 'FL' ? ` · bets ${fmt(o.bb)} / ${fmt(o.bb * 2)}` : ''}</small>
      </div>
      <div className="field">
        <span>Bots</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <input className="slider" type="range" min={0} max={seats - 1} value={Math.min(o.bots, seats - 1)} onChange={(e) => up({ bots: Number(e.target.value) })} style={{ flex: 1, minWidth: 140 }} aria-label="Number of bots" />
          <b style={{ minWidth: 70 }}>{Math.min(o.bots, seats - 1)} bot{o.bots === 1 ? '' : 's'}</b>
        </div>
      </div>
      {o.bots > 0 ? (
        <>
          <div className="field"><span>Bot difficulty</span><Seg value={o.botDifficulty} onChange={(d: BotDifficulty) => up({ botDifficulty: d })} options={(['Mixed', 'Easy', 'Medium', 'Hard'] as BotDifficulty[]).map((d) => ({ value: d, label: d }))} /></div>
          <div className="field">
            <span>Bot selection</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Seg value={o.personaIds.length ? 'pick' : 'random'} onChange={(x) => (x === 'pick' ? setPicking(true) : up({ personaIds: [] }))} options={[{ value: 'random', label: 'Random from pool' }, { value: 'pick', label: 'Pick personas' }]} />
              {o.personaIds.length ? <span className="muted" style={{ fontSize: 12 }}>{o.personaIds.length} picked · <button className="link" style={{ background: 'none', border: 0, color: 'inherit', textDecoration: 'underline', padding: 0 }} onClick={() => setPicking(true)}>change</button></span> : null}
            </div>
          </div>
        </>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <label className="check"><input type="checkbox" checked={!o.isPrivate} onChange={(e) => up({ isPrivate: !e.target.checked })} />List in the lobby (otherwise invite link only)</label>
        <label className="check"><input type="checkbox" checked={o.fillBots} onChange={(e) => up({ fillBots: e.target.checked })} />Fill a seat with a bot when a player leaves</label>
      </div>
      <button className="btn ghost small" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={() => setAdvanced(!advanced)}>{advanced ? '▾' : '▸'} Advanced</button>
      {advanced ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <label className="field"><span>Ante</span><input className="input" type="number" min={0} value={o.ante} onChange={(e) => up({ ante: Math.max(0, Number(e.target.value)) })} /></label>
          <label className="field"><span>Min buy-in (BB)</span><input className="input" type="number" min={10} max={o.maxBuyInBB} value={o.minBuyInBB} onChange={(e) => up({ minBuyInBB: Math.max(10, Number(e.target.value)) })} /></label>
          <label className="field"><span>Max buy-in (BB)</span><input className="input" type="number" min={o.minBuyInBB} max={500} value={o.maxBuyInBB} onChange={(e) => up({ maxBuyInBB: Math.max(o.minBuyInBB, Number(e.target.value)) })} /></label>
        </div>
      ) : null}
      {picking ? <PersonaPicker max={seats - 1} initial={o.personaIds} onClose={() => setPicking(false)} onPick={(ids) => { up({ personaIds: ids, bots: Math.max(o.bots, ids.length) }); setPicking(false); }} /> : null}
    </Modal>
  );
}
