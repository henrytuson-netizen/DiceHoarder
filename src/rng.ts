/** Small deterministic RNG so the shop looks the same every load. */
export type Rng = () => number;
export function makeRng(seed: number): Rng {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
