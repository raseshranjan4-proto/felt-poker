import { CSSProperties } from 'react';
import { ARCHETYPES, COUNTRY_NAMES, Persona, Traits } from '../../../shared/personas';
import { fmt } from './Chips';

const TRAIT_LABELS: [keyof Traits, string][] = [
  ['looseness', 'Looseness'], ['aggression', 'Aggression'], ['bluffing', 'Bluffing'], ['tilt', 'Tilt'],
  ['discipline', 'Discipline'], ['position', 'Position sense'], ['chattiness', 'Chattiness'],
];

const stars = (n: number) => <>{'★'.repeat(n)}<span style={{ opacity: .28 }}>{'★'.repeat(5 - n)}</span></>;

function Portrait({ p, h }: { p: Persona; h: number }) {
  // Placeholder portrait per the handoff: initials on a grey hatched field
  return (
    <div style={{ height: h, background: 'repeating-linear-gradient(45deg,#4a4540 0 10px,#524c46 10px 20px)', position: 'relative', filter: 'grayscale(1)', display: 'flex', alignItems: 'flex-end', padding: 14 }}>
      <span style={{ font: `800 ${Math.round(h / 3)}px/.8 Archivo`, opacity: .3 }}>{p.initials}</span>
      <span style={{ position: 'absolute', right: 12, top: 12, font: '600 10px ui-monospace,monospace', opacity: .6 }}>{ARCHETYPES[p.archetype].label.toUpperCase()}</span>
    </div>
  );
}

function Bars({ p, keys, mini }: { p: Persona; keys?: (keyof Traits)[]; mini?: boolean }) {
  const list = keys ? TRAIT_LABELS.filter(([k]) => keys.includes(k)) : TRAIT_LABELS;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: mini ? 6 : 5 }}>
      {list.map(([k, label]) => (
        <div key={k} className="trait" style={mini ? { gridTemplateColumns: '78px 1fr', fontSize: 10 } : undefined}>
          <span style={{ opacity: .8 }}>{label}</span>
          <span className="bar" style={mini ? { height: 6 } : undefined}><i style={{ width: `${p.traits[k]}%` }} /></span>
          {mini ? null : <span style={{ textAlign: 'right' }}>{p.traits[k]}</span>}
        </div>
      ))}
    </div>
  );
}

/** 2d gallery card (360px, tilted, sheen). */
export function PersonaCardLarge({ p, tilt = true, style }: { p: Persona; tilt?: boolean; style?: CSSProperties }) {
  return (
    <div style={{ perspective: 1400, ...style }}>
      <div style={{ width: 360, maxWidth: '100%', background: 'linear-gradient(160deg,#3a3837,#1d1b1a)', border: '1px solid #f3f2f2', color: '#fff', transform: tilt ? 'rotateY(-10deg) rotateX(3deg)' : undefined, boxShadow: '-18px 24px 40px rgba(0,0,0,.6),0 0 0 4px #0c0a09,0 0 0 5px rgba(243,242,242,.5)', position: 'relative', overflow: 'hidden' }}>
        <Portrait p={p} h={210} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(115deg,transparent 30%,rgba(255,240,200,.18) 45%,transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <div>
              <div style={{ font: '700 26px/1.05 Archivo', letterSpacing: '-.01em' }}>{p.name}</div>
              <div style={{ font: 'italic 600 13px Archivo', marginTop: 2 }}>"{p.nickname}"</div>
            </div>
            <div style={{ font: '600 12px Archivo', textAlign: 'right' }} title={COUNTRY_NAMES[p.country]}>
              {p.country} · {p.age}
              <div style={{ letterSpacing: 2, fontSize: 14 }} aria-label={`${p.stars} of 5 stars`}>{stars(p.stars)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span className="badge solid">{ARCHETYPES[p.archetype].label}</span>
            <span className="badge">{p.difficulty}</span>
            <span className="badge quiet">Fav · {p.favGame}</span>
          </div>
          <Bars p={p} />
          <div style={{ font: '13px/1.45 Archivo', opacity: .85, borderTop: '1px solid rgba(243,242,242,.4)', paddingTop: 10 }}>{p.bio}</div>
          <div style={{ font: 'italic 700 15px/1.35 Archivo' }}>"{p.catchphrase}"</div>
          <div style={{ font: '12px Archivo', background: 'rgba(255,255,255,.07)', padding: '8px 10px' }}><b>Tell:</b> {p.tell}</div>
        </div>
      </div>
    </div>
  );
}

/** Grid tile used in the gallery. */
export function PersonaTile({ p, selected, onClick }: { p: Persona; selected?: boolean; onClick: () => void }) {
  return (
    <button className="pcard" aria-pressed={selected} onClick={onClick}>
      <Portrait p={p} h={92} />
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '700 17px/1.1 Archivo', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
            <div style={{ font: 'italic 600 12px Archivo', opacity: .9 }}>"{p.nickname}"</div>
          </div>
          <div style={{ font: '600 11px Archivo', textAlign: 'right', flex: 'none' }}>{p.country}<div style={{ letterSpacing: 1 }}>{stars(p.stars)}</div></div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className="badge solid">{ARCHETYPES[p.archetype].label}</span>
          <span className="badge">{p.difficulty}</span>
        </div>
        <Bars p={p} keys={['looseness', 'aggression', 'bluffing']} mini />
      </div>
    </button>
  );
}

export interface SessionStats { hands: number; bigPot: number; vsYou: number }

/** 2d table-hover card (270px). */
export function PersonaHover({ p, stats }: { p: Persona; stats?: SessionStats }) {
  return (
    <div style={{ width: 270, background: 'linear-gradient(#3a3837,#1d1b1a)', border: '1px solid #f3f2f2', color: '#fff', boxShadow: '0 20px 34px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.14)', textAlign: 'left' }}>
      <div style={{ display: 'flex', gap: 10, padding: 12, borderBottom: '1px solid rgba(243,242,242,.4)', alignItems: 'center' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#4a4540', boxShadow: '0 0 0 2px #f3f2f2', filter: 'grayscale(1)', font: '800 18px Archivo', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{p.initials}</div>
        <div>
          <div style={{ font: '700 17px/1.1 Archivo' }}>{p.name}</div>
          <div style={{ font: 'italic 600 12px Archivo' }}>"{p.nickname}"</div>
          <div style={{ font: '600 10px Archivo', marginTop: 2, opacity: .75 }}>{ARCHETYPES[p.archetype].label} · {stars(p.stars)}</div>
        </div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Bars p={p} keys={['looseness', 'aggression', 'bluffing', 'chattiness']} mini />
        <div style={{ font: 'italic 700 13px/1.35 Archivo', marginTop: 6 }}>"{p.catchphrase}"</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', borderTop: '1px solid rgba(243,242,242,.4)', font: '11px Archivo' }}>
        <div style={{ padding: '8px 10px', borderRight: '1px solid rgba(243,242,242,.3)' }}><b style={{ display: 'block', fontSize: 14 }}>{stats?.hands ?? 0}</b>hands</div>
        <div style={{ padding: '8px 10px', borderRight: '1px solid rgba(243,242,242,.3)' }}><b style={{ display: 'block', fontSize: 14 }}>{fmt(stats?.bigPot ?? 0)}</b>big pot</div>
        <div style={{ padding: '8px 10px' }}><b style={{ display: 'block', fontSize: 14, color: (stats?.vsYou ?? 0) < 0 ? '#ec3013' : (stats?.vsYou ?? 0) > 0 ? '#4cc38a' : undefined }}>{(stats?.vsYou ?? 0) > 0 ? '+' : ''}{fmt(stats?.vsYou ?? 0)}</b>vs you</div>
      </div>
    </div>
  );
}
