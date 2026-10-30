import { useMemo, useState } from 'react';
import { Archetype, ARCHETYPES, COUNTRY_NAMES, Persona, PERSONAS } from '../../../shared/personas';
import { PersonaCardLarge, PersonaTile } from '../components/PersonaCard';
import { Modal, TopBar } from '../components/ui';

function useFilters() {
  const [q, setQ] = useState('');
  const [arch, setArch] = useState<Archetype | 'all'>('all');
  const [diff, setDiff] = useState('all');
  const [country, setCountry] = useState('all');
  const [sort, setSort] = useState<'default' | 'name' | 'stars' | 'aggr'>('default');
  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const l = PERSONAS.filter((p) =>
      (!ql || p.name.toLowerCase().includes(ql) || p.nickname.toLowerCase().includes(ql))
      && (arch === 'all' || p.archetype === arch) && (diff === 'all' || p.difficulty === diff) && (country === 'all' || p.country === country));
    if (sort === 'name') l.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'stars') l.sort((a, b) => b.stars - a.stars);
    if (sort === 'aggr') l.sort((a, b) => b.traits.aggression - a.traits.aggression);
    return l;
  }, [q, arch, diff, country, sort]);
  const bar = (
    <div className="filters">
      <input className="input" placeholder="Search name or nickname" value={q} onChange={(e) => setQ(e.target.value)} style={{ height: 34, minWidth: 200, flex: '1 1 200px' }} aria-label="Search" />
      <select className="select" value={arch} onChange={(e) => setArch(e.target.value as Archetype | 'all')} aria-label="Archetype">
        <option value="all">All archetypes</option>
        {(Object.keys(ARCHETYPES) as Archetype[]).map((a) => <option key={a} value={a}>{ARCHETYPES[a].label} ({ARCHETYPES[a].count})</option>)}
      </select>
      <select className="select" value={diff} onChange={(e) => setDiff(e.target.value)} aria-label="Difficulty" style={{ minWidth: 130 }}>
        <option value="all">Any difficulty</option><option>Easy</option><option>Medium</option><option>Hard</option>
      </select>
      <select className="select" value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" style={{ minWidth: 150 }}>
        <option value="all">All countries</option>
        {Object.entries(COUNTRY_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([c, n]) => <option key={c} value={c}>{n}</option>)}
      </select>
      <select className="select" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" style={{ minWidth: 150 }}>
        <option value="default">Sort: Archetype</option><option value="name">Sort: Name</option><option value="stars">Sort: Skill</option><option value="aggr">Sort: Aggression</option>
      </select>
    </div>
  );
  return { list, bar };
}

export default function Gallery() {
  const { list, bar } = useFilters();
  const [open, setOpen] = useState<Persona | null>(null);
  return (
    <div className="page">
      <TopBar />
      <main className="page-body">
        <h1 className="page-title">Meet the bots</h1>
        <p className="muted" style={{ marginTop: 0 }}>{PERSONAS.length} personas across 8 archetypes. Each plays, talks and tilts differently. Showing {list.length}.</p>
        {bar}
        <div className="pgrid">{list.map((p) => <PersonaTile key={p.id} p={p} onClick={() => setOpen(p)} />)}</div>
      </main>
      {open ? (
        <Modal title={open.name} onClose={() => setOpen(null)}>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 20px' }}><PersonaCardLarge p={open} /></div>
          <p className="muted" style={{ margin: 0, fontSize: 13 }}>{ARCHETYPES[open.archetype].label}: {ARCHETYPES[open.archetype].plays.toLowerCase()}.</p>
        </Modal>
      ) : null}
    </div>
  );
}

export function PersonaPicker({ max, initial, onPick, onClose, single }: { max: number; initial: string[]; onPick: (ids: string[]) => void; onClose: () => void; single?: boolean }) {
  const { list, bar } = useFilters();
  const [sel, setSel] = useState<string[]>(initial);
  const toggle = (id: string) => {
    if (single) return onPick([id]);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= max ? s : [...s, id]));
  };
  return (
    <Modal wide title={single ? 'Pick a bot' : `Pick opponents · ${sel.length} of ${max}`} onClose={onClose}
      footer={single ? undefined : <><button className="btn" onClick={() => setSel([])}>Clear</button><button className="btn primary" onClick={() => onPick(sel)}>Use {sel.length} bot{sel.length === 1 ? '' : 's'}</button></>}>
      {bar}
      <div className="pgrid">{list.map((p) => <PersonaTile key={p.id} p={p} selected={sel.includes(p.id)} onClick={() => toggle(p.id)} />)}</div>
    </Modal>
  );
}
