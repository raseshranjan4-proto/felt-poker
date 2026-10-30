import { useState } from 'react';
import { CardBack, PlayingCard } from '../components/Card';
import { Avatar, Seg, TopBar } from '../components/ui';
import { send, useNet } from '../net';
import { AVATARS, CardBackKind, FeltKind, FELTS, updateSettings, useSettings } from '../settings';

const BACKS: [CardBackKind, string, string][] = [
  ['range', 'The Range', 'The 13×13 starting-hand matrix as a heat map. Pairs form a red X.'],
  ['moire', 'Moiré', 'Two offset ring grids interfere and shimmer as cards move.'],
  ['prism', 'Prism', 'Faceted conic colour field with nested diamonds.'],
];

export default function SettingsScreen() {
  const s = useSettings();
  const { me } = useNet();
  const [name, setName] = useState(me?.name ?? '');
  const [avatar, setAvatar] = useState(me?.avatar ?? 'a0');
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = name.trim() !== me?.name || avatar !== me?.avatar;

  return (
    <div className="page">
      <TopBar />
      <main className="page-body">
        <h1 className="page-title">Settings</h1>
        <div className="settings-grid" style={{ marginTop: 16 }}>
          <section className="panel">
            <h3>Profile</h3>
            <label className="field"><span>Nickname</span><input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} /></label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(40px,1fr))', gap: 6 }}>
              {AVATARS.map((a) => (
                <button key={a} aria-label={`Avatar ${a.slice(1)}`} aria-pressed={a === avatar} onClick={() => setAvatar(a)} style={{ background: 'none', border: 0, padding: 3, outline: a === avatar ? '2px solid var(--accent)' : 'none' }}>
                  <Avatar code={a} size={32} ring={a === avatar} />
                </button>
              ))}
            </div>
            <button className="btn primary" disabled={!dirty || name.trim().length < 3} onClick={() => send({ t: 'rename', name: name.trim(), avatar })}>Save profile</button>
            <div style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {confirmReset ? (
                <>
                  <span>Reset your balance to 10,000?</span>
                  <button className="btn small primary" onClick={() => { send({ t: 'resetChips' }); setConfirmReset(false); }}>Reset</button>
                  <button className="btn small" onClick={() => setConfirmReset(false)}>Cancel</button>
                </>
              ) : <button className="btn small" onClick={() => setConfirmReset(true)}>Reset chips</button>}
            </div>
          </section>

          <section className="panel">
            <h3>Table</h3>
            <div className="field">
              <span>Felt</span>
              <div style={{ display: 'flex', gap: 10 }}>
                {(Object.keys(FELTS) as FeltKind[]).map((f) => (
                  <button key={f} aria-pressed={s.felt === f} onClick={() => updateSettings({ felt: f })} style={{ width: 84, height: 56, background: FELTS[f].flat, border: s.felt === f ? '2px solid #f3f2f2' : '2px solid transparent', color: '#fff', font: '700 12px Archivo', display: 'flex', alignItems: 'flex-end', padding: 6 }}>{FELTS[f].label}</button>
                ))}
              </div>
            </div>
            <label className="check"><input type="checkbox" checked={s.fourColor} onChange={(e) => updateSettings({ fourColor: e.target.checked })} />Four-colour deck</label>
            <div style={{ display: 'flex', gap: 6 }}>{['As', 'Kh', 'Qd', 'Jc'].map((c) => <PlayingCard key={c} code={c} w={46} />)}</div>
            <label className="check"><input type="checkbox" checked={s.handHelper} onChange={(e) => updateSettings({ handHelper: e.target.checked })} />Show my best hand under my cards</label>
            <label className="check"><input type="checkbox" checked={s.botChat} onChange={(e) => updateSettings({ botChat: e.target.checked })} />Show bot table talk</label>
            <label className="check"><input type="checkbox" checked={s.autoMuck} onChange={(e) => updateSettings({ autoMuck: e.target.checked })} />Don't offer to show losing hands</label>
            <div className="field"><span>Animation speed</span><Seg value={s.anim} onChange={(a) => updateSettings({ anim: a })} options={[{ value: 'normal', label: 'Normal' }, { value: 'fast', label: 'Fast' }, { value: 'off', label: 'Off' }]} /></div>
          </section>

          <section className="panel" style={{ gridColumn: '1 / -1' }}>
            <h3>Card back</h3>
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
              {BACKS.map(([k, n, d]) => (
                <button key={k} onClick={() => updateSettings({ cardBack: k })} aria-pressed={s.cardBack === k}
                  style={{ display: 'flex', gap: 16, alignItems: 'flex-end', padding: 12, background: 'none', color: 'inherit', textAlign: 'left', border: 0, outline: s.cardBack === k ? '2px solid #f3f2f2' : '2px solid transparent', outlineOffset: 2 }}>
                  <CardBack w={96} kind={k} />
                  <div style={{ width: 190 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', marginBottom: 10 }}><CardBack w={28} kind={k} /><CardBack w={46} kind={k} /></div>
                    <div style={{ font: '800 17px Archivo', marginBottom: 4 }}>{n}{s.cardBack === k ? <span className="badge red" style={{ marginLeft: 8 }}>In use</span> : null}</div>
                    <div style={{ font: '12px/1.5 Archivo', opacity: .85 }}>{d}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
