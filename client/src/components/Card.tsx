import { CSSProperties, memo } from 'react';
import { cardName } from '../../../shared/cards';
import { CardBackKind, useSettings } from '../settings';

// Visual spec: design_handoff "Cards" (ivory faces, Georgia ranks, standard pips, framed court cards).
const SU: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
const RED = '#c0281b', INK = '#1c1b1a', BLUE = '#1f56b8', GREEN = '#1c7a3e';
const SERIF = 'Georgia,"Times New Roman",serif';
const SH = '0 1px 0 rgba(255,255,255,.8) inset,0 2px 2px rgba(0,0,0,.35),0 8px 14px rgba(0,0,0,.3)';
const PIPS: Record<string, [number, number][]> = {
  A: [[.5, .5]], 2: [[.5, 0], [.5, 1]], 3: [[.5, 0], [.5, .5], [.5, 1]], 4: [[0, 0], [1, 0], [0, 1], [1, 1]],
  5: [[0, 0], [1, 0], [.5, .5], [0, 1], [1, 1]], 6: [[0, 0], [1, 0], [0, .5], [1, .5], [0, 1], [1, 1]],
  7: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [0, 1], [1, 1]],
  8: [[0, 0], [1, 0], [.5, .25], [0, .5], [1, .5], [.5, .75], [0, 1], [1, 1]],
  9: [[0, 0], [1, 0], [0, .333], [1, .333], [.5, .5], [0, .667], [1, .667], [0, 1], [1, 1]],
  T: [[0, 0], [1, 0], [.5, .167], [0, .333], [1, .333], [0, .667], [1, .667], [.5, .833], [0, 1], [1, 1]],
};

export interface CardOpts {
  dim?: boolean;
  hi?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export const PlayingCard = memo(function PlayingCard({ code, w, dim, hi, style, onClick }: { code: string; w: number } & CardOpts) {
  const { fourColor } = useSettings();
  const r = code[0], s = code[1];
  const col = s === 'h' ? RED : s === 'd' ? (fourColor ? BLUE : RED) : s === 'c' ? (fourColor ? GREEN : INK) : INK;
  const rank = r === 'T' ? '10' : r;
  const g = SU[s];
  const corner = (rot: boolean) => (
    <div style={{ position: 'absolute', [rot ? 'right' : 'left']: w * .06, [rot ? 'bottom' : 'top']: w * .04, transform: rot ? 'rotate(180deg)' : undefined, textAlign: 'center', lineHeight: 1, color: col, fontFamily: SERIF, fontWeight: 700 }}>
      <div style={{ fontSize: w * (rank === '10' ? .23 : .28), letterSpacing: rank === '10' ? -w * .02 : 0 }}>{rank}</div>
      <div style={{ fontSize: w * .2, marginTop: w * .01 }}>{g}</div>
    </div>
  );
  // Small cards keep only the corner index so they stay legible
  const small = w < 40;
  return (
    <div
      role="img"
      aria-label={cardName(code)}
      onClick={onClick}
      style={{
        position: 'relative', width: w, height: w * 1.4, flex: 'none', boxSizing: 'border-box', borderRadius: w * .08,
        background: 'linear-gradient(155deg,#fffefa,#f2ecdc)', boxShadow: SH, border: '1px solid rgba(0,0,0,.2)',
        opacity: dim ? .45 : 1, outline: hi ? `${Math.max(2, w * .035)}px solid #ec3013` : undefined, outlineOffset: 1,
        cursor: onClick ? 'pointer' : 'default', ...style,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: 'linear-gradient(115deg,rgba(255,255,255,.55),transparent 38%)', pointerEvents: 'none' }} />
      {small ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: col, fontFamily: SERIF, fontWeight: 700, lineHeight: 1 }}>
          <div style={{ fontSize: w * .48 }}>{rank}</div>
          <div style={{ fontSize: w * .4 }}>{g}</div>
        </div>
      ) : (
        <>
          {corner(false)}
          {corner(true)}
          {PIPS[r] ? (
            <div style={{ position: 'absolute', left: '25%', right: '25%', top: '14%', bottom: '14%' }}>
              {PIPS[r].map(([x, y], i) => (
                <div key={i} style={{ position: 'absolute', left: x * 100 + '%', top: y * 100 + '%', transform: 'translate(-50%,-50%)' + (y > .5 ? ' rotate(180deg)' : ''), fontSize: r === 'A' ? w * .56 : w * .2, lineHeight: 1, color: col }}>{g}</div>
              ))}
            </div>
          ) : (
            <div style={{ position: 'absolute', left: '21%', right: '21%', top: '11%', bottom: '11%', border: `${Math.max(1, w * .015)}px solid ${col}`, borderRadius: w * .03, background: 'linear-gradient(135deg,rgba(236,48,19,.2) 50%,rgba(236,48,19,.07) 50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', color: col, fontFamily: SERIF, overflow: 'hidden' }}>
              <div style={{ fontSize: w * .2, lineHeight: 1, paddingTop: w * .03 }}>{g}</div>
              <div style={{ fontSize: w * .5, fontWeight: 700, fontStyle: 'italic', lineHeight: 1 }}>{rank}</div>
              <div style={{ fontSize: w * .2, lineHeight: 1, paddingBottom: w * .03, transform: 'rotate(180deg)' }}>{g}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
});

const rangeCells = (() => {
  const cells: string[] = [];
  for (let i = 0; i < 13; i++) for (let j = 0; j < 13; j++) {
    const d = Math.max(Math.abs(i - 6), Math.abs(j - 6)), diag = i === j || i + j === 12;
    cells.push(diag ? 'oklch(.52 .2 30)' : `oklch(${(.86 - d * .105).toFixed(3)} ${(.02 - d * .002).toFixed(3)} 30)`);
  }
  return cells;
})();

export const CardBack = memo(function CardBack({ w, kind, style }: { w: number; kind?: CardBackKind; style?: CSSProperties }) {
  const settings = useSettings();
  const k = kind ?? settings.cardBack;
  const bw = Math.max(.6, w * .012);
  const ins: CSSProperties = { width: '100%', height: '100%', boxSizing: 'border-box', borderRadius: w * .04, border: '1px solid rgba(243,242,242,.8)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' };
  let inner;
  if (k === 'range') {
    inner = (
      <div style={{ ...ins, background: '#201e1d' }}>
        {w >= 30 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13,1fr)', gap: w > 60 ? 1 : 0.5, width: '82%', aspectRatio: '1' }}>
            {rangeCells.map((c, i) => <div key={i} style={{ background: c }} />)}
          </div>
        ) : (
          <div style={{ width: '70%', aspectRatio: '1', background: 'linear-gradient(45deg,transparent 45%,oklch(.52 .2 30) 45% 55%,transparent 55%),linear-gradient(-45deg,transparent 45%,oklch(.52 .2 30) 45% 55%,transparent 55%),radial-gradient(#d8d4cf,#3a3837)' }} />
        )}
      </div>
    );
  } else if (k === 'moire') {
    inner = <div style={{ ...ins, backgroundColor: '#201e1d', backgroundImage: `repeating-radial-gradient(circle at 30% 35%,rgba(236,48,19,.95) 0 ${bw}px,transparent ${bw}px ${w * .05}px),repeating-radial-gradient(circle at 70% 65%,rgba(244,234,206,.85) 0 ${bw}px,transparent ${bw}px ${w * .05}px)` }} />;
  } else {
    inner = (
      <div style={{ ...ins, background: 'conic-gradient(from 20deg at 50% 50%,#201e1d,#ec3013,#f3f2f2,#201e1d,#ec3013,#f3f2f2,#201e1d)' }}>
        <div style={{ position: 'absolute', inset: '24%', transform: 'rotate(45deg)', border: '1px solid #f3f2f2', background: 'linear-gradient(135deg,rgba(255,255,255,.4),rgba(0,0,0,.4))' }} />
        <div style={{ position: 'absolute', inset: '38%', transform: 'rotate(45deg)', border: '1px solid rgba(243,226,176,.8)' }} />
      </div>
    );
  }
  return (
    <div aria-label="Face-down card" style={{ position: 'relative', width: w, height: w * 1.4, flex: 'none', boxSizing: 'border-box', padding: w * .05, borderRadius: w * .08, background: 'linear-gradient(155deg,#fffefa,#e8e0cc)', boxShadow: SH, border: '1px solid rgba(0,0,0,.25)', ...style }}>
      {inner}
    </div>
  );
});

/** Fanned hand, as in the mockup's fan(): each card rotated about a point below the hand. */
export function Fan({ cards, w, angle = 5, overlap = .3, lift, hi, dim, onCard, faceDown }: {
  cards: string[]; w: number; angle?: number; overlap?: number;
  lift?: (i: number) => boolean; hi?: (i: number) => boolean; dim?: (i: number) => boolean;
  onCard?: (i: number) => void; faceDown?: boolean;
}) {
  return (
    <div style={{ display: 'flex' }}>
      {cards.map((c, i) => {
        const m = (i - (cards.length - 1) / 2) * angle;
        return (
          <div key={c + i} style={{ marginLeft: i ? -w * overlap : 0, transform: `rotate(${m}deg) translateY(${Math.abs(m) * 1.2 + (lift?.(i) ? -w * .2 : 0)}px)`, transformOrigin: '50% 120%', transition: 'transform .18s ease-out' }}>
            {faceDown ? <CardBack w={w} /> : <PlayingCard code={c} w={w} hi={hi?.(i)} dim={dim?.(i)} onClick={onCard ? () => onCard(i) : undefined} />}
          </div>
        );
      })}
    </div>
  );
}

export function EmptySlot({ w }: { w: number }) {
  return <div style={{ width: w, height: w * 1.4, borderRadius: w * .08, border: '2px dashed rgba(255,255,255,.4)', boxSizing: 'border-box', flex: 'none' }} />;
}
