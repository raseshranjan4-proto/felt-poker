import { useSyncExternalStore } from 'react';

export type CardBackKind = 'range' | 'moire' | 'prism';
export type FeltKind = 'green' | 'graphite' | 'red';

export interface Settings {
  cardBack: CardBackKind;
  felt: FeltKind;
  fourColor: boolean;
  anim: 'normal' | 'fast' | 'off';
  handHelper: boolean;
  botChat: boolean;
  autoMuck: boolean;
}

const KEY = 'felt.settings';
const DEFAULTS: Settings = { cardBack: 'range', felt: 'green', fourColor: false, anim: 'normal', handHelper: true, botChat: true, autoMuck: true };

let settings: Settings = DEFAULTS;
try { settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { /* storage blocked */ }

const listeners = new Set<() => void>();
const applyBodyClass = () => {
  document.body.dataset.anim = settings.anim;
};
applyBodyClass();

export function updateSettings(patch: Partial<Settings>) {
  settings = { ...settings, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* storage blocked */ }
  applyBodyClass();
  listeners.forEach((l) => l());
}

export function useSettings(): Settings {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => settings);
}

export const getSettings = () => settings;

export const FELTS: Record<FeltKind, { plane: string; flat: string; label: string }> = {
  green: { label: 'Green', plane: 'radial-gradient(ellipse at 50% 42%,#27895a 0,#17653f 45%,#0d4529 80%,#082e1c)', flat: 'radial-gradient(ellipse at 50% 30%,#2a8a5b,#14603c 45%,#0a3a24 85%)' },
  graphite: { label: 'Graphite', plane: 'radial-gradient(ellipse at 50% 42%,#5a5754 0,#3a3836 45%,#262423 80%,#181716)', flat: 'radial-gradient(ellipse at 50% 30%,#55524f,#34312f 50%,#1c1b1a 90%)' },
  red: { label: 'Red', plane: 'radial-gradient(ellipse at 50% 42%,#d4401f 0,#a82a12 45%,#6e1809 80%,#3e0d05)', flat: 'radial-gradient(ellipse at 50% 30%,#d4401f,#a02610 50%,#5a1308 90%)' },
};

// 24 guest avatars: a glyph on a tinted disc
export const AVATARS = Array.from({ length: 24 }, (_, i) => `a${i}`);
const GLYPHS = ['♠', '♥', '♦', '♣', '★', '◆', '●', '▲', '♛', '♜', '☀', '☾'];
const TINTS = ['#ec3013', '#2a63b0', '#1e8049', '#caa443', '#6d3f93', '#f3f2f2'];
export function avatarLook(code: string): { glyph: string; bg: string; fg: string } | null {
  const m = /^a(\d+)$/.exec(code);
  if (!m) return null;
  const i = Number(m[1]) % 24;
  const bg = TINTS[i % TINTS.length];
  return { glyph: GLYPHS[i % GLYPHS.length], bg, fg: bg === '#f3f2f2' || bg === '#caa443' ? '#201e1d' : '#fff' };
}
