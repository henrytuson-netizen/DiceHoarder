import type { DiceSet } from './sets';
import { MATERIAL_LABEL } from './sets';

/** The shop PC: a map of all 402 slots, opened from the computer in the back room. */
export class ShopComputer {
  private readonly root = document.getElementById('pc') as HTMLElement;
  isOpen = false;

  constructor(private readonly sets: DiceSet[], private readonly slotOfSet: number[], private readonly onReset: () => void) {
    this.root.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.dataset.action === 'close') this.close();
      if (t.dataset.action === 'reset' && confirm('Reset all sorting progress?')) this.onReset();
    });
  }

  open(mask: Uint8Array): void {
    this.isOpen = true;
    document.exitPointerLock?.();
    const setOfSlot: number[] = [];
    this.slotOfSet.forEach((slot, setId) => { setOfSlot[slot] = setId; });
    const bits = (m: number) => { let c = 0; for (let i = 0; i < 7; i++) if (m & (1 << i)) c++; return c; };
    const done = Array.from(mask).filter((m) => m === 127).length;
    const diceIn = Array.from(mask).reduce((a, m) => a + bits(m), 0);
    const cell = (slot: number) => {
      const set = this.sets[setOfSlot[slot]]; const n = bits(mask[set.id]);
      const cls = n === 7 ? 'full' : n > 0 ? 'part' : 'empty';
      return `<div class="cell ${cls}" style="--c:${set.base.hex};--i:${set.ink.hex}" title="${set.name} — ${n}/7"></div>`;
    };
    const groups: string[] = [];
    (['plastic', 'solidResin', 'clearResin', 'metal', 'gemstone'] as const).forEach((m, k) => {
      const cells = Array.from({ length: 66 }, (_, i) => cell(k * 66 + i)).join('');
      groups.push(`<section><h3>Tables · ${MATERIAL_LABEL[m]}</h3><div class="grid">${cells}</div></section>`);
    });
    groups.push(`<section><h3>Wall racks · Special + extras</h3><div class="grid">${Array.from({ length: 72 }, (_, i) => cell(330 + i)).join('')}</div></section>`);
    this.root.innerHTML = `<div class="pc-screen">
      <header><b>STORE INVENTORY</b><span>${done} / ${this.sets.length} sets complete · ${diceIn} / ${this.sets.length * 7} dice sorted</span>
      <button data-action="reset">Reset progress</button><button data-action="close">Close (E)</button></header>
      <p class="legend"><i class="cell full"></i> complete <i class="cell part"></i> started <i class="cell empty"></i> empty · hover a slot to see its set</p>
      <div class="groups">${groups.join('')}</div></div>`;
    this.root.style.display = 'flex';
  }

  close(): void { this.isOpen = false; this.root.style.display = 'none'; }
}
