import { useEffect, useState } from 'react';
import { PlayingCard } from '../components/Card';
import { fmt } from '../components/Chips';
import { TopBar } from '../components/ui';
import { send, useNet } from '../net';

export default function History() {
  const { history, status } = useNet();
  const [open, setOpen] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => { if (status === 'open') send({ t: 'history' }); }, [status]);
  const hand = history.find((h) => h.id === open);

  return (
    <div className="page">
      <TopBar />
      <main className="page-body">
        <h1 className="page-title">Hand history</h1>
        <p className="muted" style={{ marginTop: 0 }}>Your last {history.length ? history.length : 100} hands. Select one to replay it step by step.</p>
        {history.length === 0 ? <div className="empty">No hands yet. Sit down at a table and they will appear here.</div> : null}
        {history.map((h) => (
          <div key={h.id}>
            <button className="hrow" onClick={() => { setOpen(open === h.id ? null : h.id); setStep(0); }} aria-expanded={open === h.id}>
              <span className="desk muted">{new Date(h.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span><b>{h.tableName}</b><span className="muted"> · {h.headline}</span></span>
              <span className="desk"><span className="badge quiet">{h.game}</span></span>
              <span className="desk">{h.stakes}</span>
              <span className="desk" style={{ display: 'flex', gap: 3 }}>{h.hole.map((c) => <PlayingCard key={c} code={c} w={24} />)}</span>
              <b className={h.net > 0 ? 'pos' : h.net < 0 ? 'neg' : 'muted'} style={{ textAlign: 'right' }}>{h.net > 0 ? '+' : ''}{fmt(h.net)}</b>
            </button>
            {open === h.id && hand ? (
              <div className="panel" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div><div className="eyebrow" style={{ marginBottom: 6 }}>Your cards</div><div style={{ display: 'flex', gap: 4 }}>{hand.hole.map((c) => <PlayingCard key={c} code={c} w={44} />)}</div></div>
                  {hand.boards.map((b, i) => (
                    <div key={i}><div className="eyebrow" style={{ marginBottom: 6 }}>{hand.boards.length > 1 ? `Board ${i + 1}` : 'Board'}</div>
                      <div style={{ display: 'flex', gap: 4 }}>{b.map((c, k) => <PlayingCard key={c} code={c} w={44} dim={!boardShown(hand.log, step, k)} />)}</div></div>
                  ))}
                </div>
                <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2, fontSize: 13 }}>
                  {hand.log.slice(0, step + 1).map((l, i) => <li key={i} style={{ fontWeight: i === step ? 700 : 400, opacity: i === step ? 1 : .7 }}>{l}</li>)}
                </ol>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn small" disabled={step === 0} onClick={() => setStep(step - 1)}>Previous</button>
                  <button className="btn small" disabled={step >= hand.log.length - 1} onClick={() => setStep(step + 1)}>Next</button>
                  <button className="btn small" onClick={() => setStep(hand.log.length - 1)}>Show all</button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </main>
    </div>
  );
}

/** Board card k is visible once the log has reached the street that deals it. */
function boardShown(log: string[], step: number, k: number) {
  const seen = log.slice(0, step + 1).join('\n');
  if (k < 3) return /\nFlop:/.test('\n' + seen);
  if (k === 3) return /\nTurn:/.test('\n' + seen);
  return /\nRiver:/.test('\n' + seen);
}
