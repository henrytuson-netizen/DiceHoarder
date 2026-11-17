/** Tiny synthesised sounds: dice click-clack and a set-complete chime. No audio files. */
let ctx: AudioContext | null = null;
let lastClack = 0;

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** A short hard click like dice knocking together. */
export function clack(volume = 0.5, pitch = 1): void {
  const a = ac(); if (!a) return;
  const now = a.currentTime;
  if (now - lastClack < 0.03) return;
  lastClack = now;
  const len = 0.05, buf = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 6);
  const src = a.createBufferSource(); src.buffer = buf; src.playbackRate.value = pitch * (0.85 + Math.random() * 0.3);
  const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400 * pitch; bp.Q.value = 3;
  const g = a.createGain(); g.gain.value = Math.min(1, volume);
  src.connect(bp).connect(g).connect(a.destination); src.start(now);
}

/** A soft rising two-note chime. */
export function chime(): void {
  const a = ac(); if (!a) return;
  const now = a.currentTime;
  [[784, 0], [1175, 0.12], [1568, 0.24]].forEach(([f, t]) => {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = a.createGain(); g.gain.setValueAtTime(0, now + t); g.gain.linearRampToValueAtTime(0.18, now + t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.9);
    o.connect(g).connect(a.destination); o.start(now + t); o.stop(now + t + 1);
  });
}
