import { SET_KINDS, type DieKind } from './dice';

const ICONS: Record<DieKind, string> = {
  4: '8,1 15,15 1,15', 6: '2,2 14,2 14,14 2,14', 8: '8,0 16,8 8,16 0,8', 10: '8,0 15,6 8,16 1,6',
  100: '8,0 15,6 8,16 1,6', 12: '8,0 15,6 12,15 4,15 1,6', 20: '8,0 15,4 15,12 8,16 1,12 1,4',
};
const el = (id: string) => document.getElementById(id);
const set = (id: string, v: string) => { const e = el(id); if (e) e.textContent = v; };

export type IconState = 'slot' | 'hand' | 'none';
export interface HudState {
  held?: { kind: DieKind; material: string; colour: string; hex: string };
  icons: IconState[];   // per die kind of the held set
  inSlot: number;
  hand: number;
  handMax: number;
  sorted: number;
  total: number;
}

export function renderHud(s: HudState): void {
  set('hud-die', s.held ? (s.held.kind === 100 ? 'd%' : `d${s.held.kind}`) : '-');
  set('hud-material', s.held?.material ?? '-');
  set('hud-color', s.held?.colour ?? '-');
  set('hud-setcount', s.held ? `${s.inSlot} / 7 in slot` : '-');
  set('hud-hand', `${s.hand} / ${s.handMax}`);
  set('hud-progress', `${s.sorted} / ${s.total}`);
  const icons = el('hud-set');
  if (icons) icons.innerHTML = SET_KINDS.map((k, i) => {
    const st = s.icons[i] ?? 'none';
    const fill = st === 'slot' ? (s.held?.hex ?? '#f0a8c8') : 'none';
    const stroke = st === 'hand' ? '#7cc4ff' : '#f6ecd9';
    return `<svg width="22" height="22" viewBox="0 0 16 16"><polygon points="${ICONS[k]}" fill="${fill}" stroke="${stroke}" stroke-opacity="${st === 'none' ? 0.45 : 1}" stroke-width="${st === 'hand' ? 1.8 : 1.2}"/></svg>`;
  }).join('');
}

export function prompt(text: string, tone: 'ok' | 'bad' | 'info' = 'info'): void {
  const e = el('prompt'); if (!e) return;
  e.textContent = text; e.className = `tone-${tone}`; e.style.display = text ? 'block' : 'none';
}

let toastTimer = 0;
export function toast(text: string): void {
  const e = el('toast'); if (!e) return;
  e.textContent = text; e.classList.add('show');
  clearTimeout(toastTimer); toastTimer = window.setTimeout(() => e.classList.remove('show'), 2600);
}
