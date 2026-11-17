/**
 * The 402 unique dice sets. A set is unique by material + base colour + ink colour.
 * Generated deterministically so every player gets the same catalogue.
 */
import { makeRng } from './rng';
import { TOTAL_SETS } from './config';

export type MaterialKind = 'plastic' | 'solidResin' | 'clearResin' | 'metal' | 'gemstone' | 'special';
export const MATERIAL_KINDS: MaterialKind[] = ['plastic', 'solidResin', 'clearResin', 'metal', 'gemstone', 'special'];
export const MATERIAL_LABEL: Record<MaterialKind, string> = {
  plastic: 'Plastic', solidResin: 'Solid Resin', clearResin: 'Clear Resin', metal: 'Metal', gemstone: 'Gemstone', special: 'Special',
};

export interface NamedColour { name: string; hex: string }
const BASE_COLOURS: NamedColour[] = [
  { name: 'Ruby', hex: '#c8204a' }, { name: 'Coral', hex: '#ef6f61' }, { name: 'Amber', hex: '#e8a33c' }, { name: 'Gold', hex: '#e0b43a' },
  { name: 'Lime', hex: '#8ad43c' }, { name: 'Emerald', hex: '#1fa860' }, { name: 'Teal', hex: '#2fb7a4' }, { name: 'Sky', hex: '#6ad0ff' },
  { name: 'Cobalt', hex: '#2a4fc0' }, { name: 'Violet', hex: '#8a6ad6' }, { name: 'Pink', hex: '#e89bbd' }, { name: 'Ivory', hex: '#eae6dc' },
  { name: 'Silver', hex: '#cfd4dc' }, { name: 'Copper', hex: '#c9774c' }, { name: 'Onyx', hex: '#2a2a2e' },
];
const INKS: NamedColour[] = [
  { name: 'White', hex: '#fff4e0' }, { name: 'Black', hex: '#1a1414' }, { name: 'Gold', hex: '#e9c25a' },
  { name: 'Silver', hex: '#d8dde4' }, { name: 'Red', hex: '#c0202a' }, { name: 'Blue', hex: '#2040c0' },
];

export interface DiceSet {
  id: number;
  material: MaterialKind;
  base: NamedColour;
  ink: NamedColour;
  name: string;
}

function contrast(a: string, b: string): number {
  const l = (h: string) => { const n = parseInt(h.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
  return Math.abs(l(a) - l(b));
}

export function buildSetCatalogue(): DiceSet[] {
  const rng = makeRng(402);
  const perMaterial = Math.ceil(TOTAL_SETS / MATERIAL_KINDS.length); // 67
  const sets: DiceSet[] = [];
  for (const material of MATERIAL_KINDS) {
    // every readable base+ink pair for this material, shuffled
    const pairs: [NamedColour, NamedColour][] = [];
    for (const base of BASE_COLOURS) for (const ink of INKS) if (contrast(base.hex, ink.hex) > 0.18 && base.name !== ink.name) pairs.push([base, ink]);
    for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
    for (const [base, ink] of pairs.slice(0, perMaterial)) {
      if (sets.length >= TOTAL_SETS) break;
      sets.push({ id: sets.length, material, base, ink, name: `${MATERIAL_LABEL[material]} · ${base.name} · ${ink.name} ink` });
    }
  }
  if (sets.length !== TOTAL_SETS) throw new Error(`Expected ${TOTAL_SETS} sets, got ${sets.length}`);
  return sets;
}
