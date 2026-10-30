import { useState } from 'react';
import { Fan } from '../components/Card';
import { Avatar } from '../components/ui';
import { connect, loadIdentity, newToken, saveIdentity, send } from '../net';
import { AVATARS } from '../settings';
import { practiceOpts } from './Lobby';

const RANDOM_NAMES = ['RiverRat', 'NutsOrBust', 'FoldEmFred', 'LuckyLina', 'ChipChaser', 'AceHigh', 'TiltProof', 'ButtonBully', 'SlowRoll', 'FlopQueen'];

export default function Welcome({ onDone }: { onDone: () => void }) {
  const existing = loadIdentity();
  const [name, setName] = useState(existing?.name ?? '');
  const [avatar, setAvatar] = useState(existing?.avatar ?? AVATARS[Math.floor(Math.random() * 24)]);
  const valid = name.trim().length >= 3 && name.trim().length <= 16;

  const go = (quick: boolean) => {
    const nm = quick && !valid ? `${RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]}${Math.floor(Math.random() * 90 + 10)}` : name.trim();
    saveIdentity({ token: existing?.token ?? newToken(), name: nm, avatar });
    connect();
    if (quick) send({ t: 'createTable', opts: practiceOpts(nm) });
    onDone();
  };

  return (
    <div className="page" style={{ alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="plate" style={{ width: 'min(520px, 100%)', padding: 28, display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 26, top: 22, pointerEvents: 'none' }}><Fan cards={['Ah', 'Ad']} w={58} angle={6} overlap={.45} /></div>
        <div>
          <div className="kicker">Welcome to</div>
          <div style={{ font: '800 44px/1 Archivo', letterSpacing: '-.03em' }}>FELT<span style={{ color: 'var(--accent)' }}>.</span></div>
          <p className="muted" style={{ margin: '10px 0 0', maxWidth: 300 }}>Hold'em and Omaha against 260 bots with personalities, or with friends.</p>
        </div>
        <label className="field">
          <span>Nickname</span>
          <input className="input" value={name} maxLength={16} placeholder="3 to 16 characters" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && valid) go(false); }} autoFocus />
        </label>
        <div className="field">
          <span>Avatar</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 8 }}>
            {AVATARS.map((a) => (
              <button key={a} type="button" aria-label={`Avatar ${a.slice(1)}`} aria-pressed={a === avatar} onClick={() => setAvatar(a)}
                style={{ background: 'none', border: 0, padding: 4, outline: a === avatar ? '2px solid var(--accent)' : 'none', display: 'flex', justifyContent: 'center' }}>
                <Avatar code={a} size={36} ring={a === avatar} />
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,.05)', font: '13px Archivo' }}>
          You start with <b>10,000</b> play chips. Play chips only, no real money.
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="btn primary" style={{ flex: 1 }} disabled={!valid} onClick={() => go(false)}>Let's play</button>
          <button className="btn" onClick={() => go(true)}>Quick play</button>
        </div>
      </div>
    </div>
  );
}
