import { CSSProperties, memo } from 'react';

// Visual spec: design_handoff "Chips" (top-down 3/4 view, dashed edge spots, stacked columns).
type Den = [number, string, string];
export const DEN: Den[] = [[1000, '#caa443', '#fff2b8'], [500, '#6d3f93', '#f3e8ff'], [100, '#262626', '#f2f2f2'], [25, '#1e8049', '#e9fff0'], [5, '#bf2b1d', '#ffffff'], [1, '#ece8de', '#2a63b0']];

function ChipEl({ d, i, w }: { d: Den; i: number; w: number }) {
  const [, c, s] = d, ch = w * .44, bh = w * .2;
  return (
    <div style={{ position: 'absolute', left: 0, bottom: i * w * .12, width: w, height: ch / 2 + bh }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: ch / 2, height: bh, borderRadius: `0 0 ${w / 2}px ${w / 2}px / 0 0 ${ch / 2}px ${ch / 2}px`, background: `linear-gradient(90deg,rgba(0,0,0,.5),transparent 35%,rgba(255,255,255,.2) 50%,transparent 65%,rgba(0,0,0,.55)),repeating-linear-gradient(90deg,${s} 0 ${w * .1}px,${c} ${w * .1}px ${w * .22}px)` }} />
      <div style={{ position: 'absolute', left: 0, top: 0, width: w, height: ch, boxSizing: 'border-box', borderRadius: '50%', background: `linear-gradient(180deg,rgba(255,255,255,.32),rgba(0,0,0,.2)),${c}`, border: `${Math.max(2, w * .08)}px dashed ${s}` }}>
        <div style={{ position: 'absolute', inset: '14% 16%', borderRadius: '50%', border: `1px solid ${s}`, opacity: .75 }} />
      </div>
    </div>
  );
}

export function SingleChip({ value = 100, w }: { value?: number; w: number }) {
  const d = DEN.find((x) => x[0] === value) ?? DEN[2];
  return <div style={{ position: 'relative', width: w, height: w * .42 + w * .2 }}><ChipEl d={d} i={0} w={w} /></div>;
}

/** Greedy by denomination, at most 4 columns of 9 chips, alternate columns raised. */
export const ChipStack = memo(function ChipStack({ amount, w, label, style }: { amount: number; w: number; label?: string; style?: CSSProperties }) {
  let rem = Math.max(0, Math.round(amount));
  let cols: [Den, number][] = [];
  for (const d of DEN) {
    const n = Math.floor(rem / d[0]);
    if (n > 0) { cols.push([d, Math.min(n, 9)]); rem -= n * d[0]; }
  }
  if (!cols.length) cols = [[DEN[5], 1]];
  cols = cols.slice(0, 4);
  const step = w * .78, W = w + (cols.length - 1) * step;
  const mx = Math.max(...cols.map((c) => c[1]));
  const H = w * .42 + mx * w * .12 + w * .08 + w * .16;
  const kids = cols
    .map(([d, n], k) => ({ off: (k % 2) * w * .16, k, d, n }))
    .sort((a, b) => b.off - a.off);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', ...style }}>
      {label ? <div className="chip-label">{label}</div> : null}
      <div style={{ position: 'relative', width: W, height: H }}>
        <div style={{ position: 'absolute', left: -4, right: -4, bottom: -4, height: w * .3, borderRadius: '50%', background: 'rgba(0,0,0,.4)', filter: 'blur(4px)' }} />
        {kids.map(({ k, d, n }) => (
          <div key={k} style={{ position: 'absolute', left: k * step, bottom: (k % 2) * w * .16, width: w, height: w * .42 + n * w * .12 }}>
            {Array.from({ length: n }, (_, i) => <ChipEl key={i} d={d} i={i} w={w} />)}
          </div>
        ))}
      </div>
    </div>
  );
});

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
