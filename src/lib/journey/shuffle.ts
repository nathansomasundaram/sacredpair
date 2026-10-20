/**
 * A repeatable shuffle: the same seed always gives the same order, so the
 * page looks the same when the server renders it and the browser takes
 * over, while each question still gets its own mixed-up order.
 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const rand = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // Never show an order puzzle already solved.
  if (out.length > 1 && out.every((v, i) => v === items[i])) {
    [out[0], out[1]] = [out[1], out[0]];
  }
  return out;
}
