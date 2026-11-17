import * as THREE from 'three';
import type { Rng } from './rng';

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void;

export function canvasTexture(draw: Draw, w = 512, h = 512, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas not available');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function floorTexture(rng: Rng, w: number, d: number): THREE.CanvasTexture {
  return canvasTexture((g, cw, ch) => {
    for (let i = 0; i < 8; i++) {
      const y = (i * ch) / 8;
      g.fillStyle = `hsl(22,${38 + rng() * 10}%,${17 + rng() * 8}%)`;
      g.fillRect(0, y, cw, ch / 8);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(40,15,0,${0.06 + rng() * 0.12})`;
        g.beginPath();
        g.moveTo(0, y + (rng() * ch) / 8);
        g.bezierCurveTo(cw * 0.3, y + (rng() * ch) / 8, cw * 0.6, y + (rng() * ch) / 8, cw, y + (rng() * ch) / 8);
        g.stroke();
      }
      g.fillStyle = 'rgba(15,6,0,.6)';
      g.fillRect(0, y, cw, 3);
      g.fillRect(Math.floor(rng() * cw), y, 3, ch / 8);
    }
  }, 1024, 1024, [w / 3.2, d / 3.2]);
}

export function woodTexture(rng: Rng): THREE.CanvasTexture {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#c27a35';
    g.fillRect(0, 0, w, h);
    for (let k = 0; k < 110; k++) {
      g.strokeStyle = `rgba(80,35,5,${0.06 + rng() * 0.16})`;
      g.lineWidth = 1 + rng() * 2;
      g.beginPath();
      g.moveTo(0, rng() * h);
      g.bezierCurveTo(w * 0.3, rng() * h, w * 0.7, rng() * h, w, rng() * h);
      g.stroke();
    }
  });
}

export function wallTexture(rng: Rng, w: number, h: number): THREE.CanvasTexture {
  return canvasTexture((g, cw, ch) => {
    g.fillStyle = '#3f7a68';
    g.fillRect(0, 0, cw, ch);
    for (let i = 0; i < 16; i++) {
      g.fillStyle = `rgba(${rng() > 0.5 ? '255,255,255' : '0,0,0'},${0.03 + rng() * 0.04})`;
      g.fillRect((i * cw) / 16, 0, cw / 16, ch);
      g.fillStyle = 'rgba(0,0,0,.25)';
      g.fillRect((i * cw) / 16, 0, 2, ch);
    }
  }, 512, 512, [w / 2, h / 2]);
}

export function plaqueTexture(letter: string): THREE.CanvasTexture {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#3a2210'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#e9c78a'; g.font = 'bold 150px Georgia';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(letter, w / 2, h / 2 + 8);
  }, 256, 256);
}

export function carpetTexture(): THREE.CanvasTexture {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#7a2c34'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#e9c78a'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) g.strokeRect(34 + i * 8, 34 + i * 8, w - 68 - i * 16, h - 68 - i * 16);
  });
}

export function basementTexture(): THREE.CanvasTexture {
  return canvasTexture((g, w, h) => {
    g.fillStyle = '#4b2e18'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#573619' : '#44291a'; g.fillRect(0, (i * h) / 6, w, h / 6 - 4); }
    g.fillStyle = '#e9c78a'; g.textAlign = 'center';
    g.font = 'bold 54px Georgia'; g.fillText('BASEMENT', w / 2, h / 2 - 6);
    g.font = '36px Georgia'; g.fillText('coming soon', w / 2, h / 2 + 48);
  });
}
