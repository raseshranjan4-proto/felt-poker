import { ReactNode, useEffect, useState } from 'react';
import { useNet, send } from '../net';
import { avatarLook } from '../settings';
import { ChipStack, fmt } from './Chips';

export function Avatar({ code, size = 38, ring = true, grayscale }: { code: string; size?: number; ring?: boolean; grayscale?: boolean }) {
  const look = avatarLook(code);
  return (
    <div
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: look ? `radial-gradient(circle at 35% 30%, rgba(255,255,255,.35), transparent 60%), ${look.bg}` : 'linear-gradient(145deg,#6b6560,#2c2a29)',
        color: look?.fg ?? '#fff', boxShadow: ring ? '0 0 0 2px #f3f2f2, 0 2px 4px rgba(0,0,0,.6)' : undefined,
        font: `${look ? 700 : 700} ${Math.round(size * (look ? .5 : .34))}px Archivo`, filter: grayscale && !look ? 'grayscale(1)' : undefined,
      }}
    >
      {look ? look.glyph : code}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${wide ? ' wide' : ''}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined}>
        <div className="modal-head"><h2>{title}</h2><button className="x" aria-label="Close" onClick={onClose}>✕</button></div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button type="button" key={String(o.value)} aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function useRoute(): string {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => {
    const f = () => setH(location.hash || '#/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

export function TopBar({ children }: { children?: ReactNode }) {
  const net = useNet();
  const route = useRoute();
  return (
    <header className="topbar">
      <a className="logo" href="#/">FELT<b>.</b></a>
      {children}
      <span className="spacer" />
      <a className="link hide-sm" href="#/bots" aria-current={route === '#/bots' ? 'page' : undefined}>Meet the bots</a>
      <a className="link hide-sm" href="#/history" aria-current={route === '#/history' ? 'page' : undefined}>Hand history</a>
      <span className="balance" title="Play chips"><ChipStack amount={100} w={18} />{fmt(net.me?.balance ?? 0)}</span>
      <button className="btn primary small" onClick={() => send({ t: 'topUp' })}>Add chips</button>
      <a href="#/settings" title="Settings" aria-label="Settings" style={{ textDecoration: 'none' }}><Avatar code={net.me?.avatar ?? ''} size={34} ring={false} /></a>
    </header>
  );
}

export function Toasts() {
  const { toasts, status, me } = useNet();
  return (
    <>
      {me && status === 'reconnecting' ? <div className="conn-banner" role="status">Reconnecting…</div> : null}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </>
  );
}
