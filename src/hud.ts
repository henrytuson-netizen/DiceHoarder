import { SET_KINDS, type DieKind } from './dice';

const ICONS: Record<DieKind, string> = {
  4: '8,1 15,15 1,15', 6: '2,2 14,2 14,14 2,14', 8: '8,0 16,8 8,16 0,8', 10: '8,0 15,6 8,16 1,6',
  100: '8,0 15,6 8,16 1,6', 12: '8,0 15,6 12,15 4,15 1,6', 20: '8,0 15,4 15,12 8,16 1,12 1,4',
};
const el = (id: string) => document.getElementById(id);

export interface HudState { die?: string; material?: string; colour?: string; collected: number; value: number; sorted: number; total: number }

export function renderHud(s: HudState): void {
  const set = (id: string, v: string) => { const e = el(id); if (e) e.textContent = v; };
  set('hud-die', s.die ?? '-');
  set('hud-material', s.material ?? '-');
  set('hud-color', s.colour ?? '-');
  set('hud-value', `${s.value} Gold`);
  set('hud-progress', `${s.sorted} / ${s.total}`);
  const icons = el('hud-set');
  if (icons) icons.innerHTML = SET_KINDS.map((k, i) => `<svg width="22" height="22" viewBox="0 0 16 16"><polygon points="${ICONS[k]}" fill="${i < s.collected ? '#f0a8c8' : 'none'}" stroke="#f6ecd9" stroke-opacity="${i < s.collected ? 1 : 0.45}" stroke-width="1.2"/></svg>`).join('');
}
